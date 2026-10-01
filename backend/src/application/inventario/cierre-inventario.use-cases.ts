/**
 * CASOS DE USO: CIERRE DEL DÍA (conteo físico y merma)
 * ====================================================
 *
 *   PrepararCierreUseCase    qué hay que contar ese día, con lo que dice el
 *                            sistema, lo en tránsito y lo esperado (no escribe)
 *   RegistrarCierreUseCase   registra el conteo: guarda el cierre con su merma
 *                            y ajusta cada existencia a CONTADO + EN TRÁNSITO
 *
 * Las reglas están en `domain/inventario/cierre-inventario.ts`. Aquí se
 * juntan los datos: recetas vigentes, existencias, remisiones sin aprobar
 * (en tránsito) y lo que descontaron las recetas desde el cierre anterior
 * (consumo teórico del periodo).
 */

import { redondear } from '../../domain/inventario/cantidad.js';
import {
  calcularLineaCierre,
  CierreYaRegistradoError,
  ESTADOS_EN_TRANSITO,
  exigirCierreCompleto,
  materialesACerrar,
  MAXIMO_LINEAS_CIERRE,
  type CierreInventario,
  type MaterialACerrar,
} from '../../domain/inventario/cierre-inventario.js';
import { convertirConteo, type Conteo } from '../../domain/inventario/conteo.js';
import { DatosInventarioInvalidosError } from '../../domain/inventario/inventario.errors.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import { aplicarMovimiento } from '../../domain/inventario/movimiento-inventario.js';
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';
import { momentoOperativo } from '../shared/momento-operativo.js';

type Repos = Pick<ContextoTransaccional, 'itemsInventario' | 'recetas' | 'remisiones' | 'movimientosInventario' | 'cierresInventario'>;

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * SOLO LEE. `bloquear`: dentro de la transacción del registro, cada material
 * se relee bloqueado (en orden de id, como las entradas) para que nadie mueva
 * su existencia mientras se calcula el ajuste.
 */
async function leerSituacion(repos: Repos, fechaOperativa: Date, bloquear: boolean): Promise<{ materiales: MaterialACerrar[]; existente: CierreInventario | null }> {
  const [existente, anterior, items, recetasVigentes, enTransito] = await Promise.all([
    repos.cierresInventario.buscarPorFecha(fechaOperativa),
    repos.cierresInventario.anteriorA(fechaOperativa),
    repos.itemsInventario.listar({}),
    repos.recetas.vigentes(),
    repos.remisiones.totalizarCajasEnEstados(ESTADOS_EN_TRANSITO),
  ]);

  // Consumo teórico del periodo: lo que descontaron las recetas desde el día
  // siguiente al cierre anterior (o solo ese día, si es el primer cierre).
  const desde = anterior ? new Date(anterior.fechaOperativa.getTime() + UN_DIA) : fechaOperativa;
  const movimientos = await repos.movimientosInventario.listar({ desde, hasta: fechaOperativa });
  const consumoTeorico = new Map<string, number>();
  for (const m of movimientos) {
    if (m.remisionId) consumoTeorico.set(m.itemId, redondear((consumoTeorico.get(m.itemId) ?? 0) - m.cantidad));
  }

  let catalogo: ItemInventario[] = items;
  if (bloquear) {
    const ids = new Set(materialesACerrar(items, recetasVigentes, new Map(), new Map()).map((m) => m.item.id));
    const bloqueados = new Map<string, ItemInventario>();
    for (const id of [...ids].sort()) {
      const item = await repos.itemsInventario.bloquearParaMovimiento(id);
      if (item) bloqueados.set(id, item);
    }
    catalogo = items.map((i) => bloqueados.get(i.id) ?? i);
  }

  const cajas = new Map(enTransito.map((e) => [e.productoId, e.cajas]));
  return { materiales: materialesACerrar(catalogo, recetasVigentes, cajas, consumoTeorico), existente };
}

export interface CierrePreparado {
  fechaOperativa: Date;
  /** Si ya se cerró ese día, el cierre registrado; si no, null. */
  cierre: CierreInventario | null;
  materiales: Array<{
    itemId: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    equivalencias: ItemInventario['equivalencias'];
    existenciaSistema: number;
    enTransito: number;
    esperado: number;
    consumoTeorico: number;
  }>;
}

export class PrepararCierreUseCase {
  constructor(private readonly repos: Repos) {}

  async ejecutar(fechaOperativa: Date): Promise<CierrePreparado> {
    const { materiales, existente } = await leerSituacion(this.repos, fechaOperativa, false);
    return {
      fechaOperativa,
      cierre: existente,
      materiales: materiales.map((m) => ({
        itemId: m.item.id,
        codigo: m.item.codigo,
        descripcion: m.item.descripcion,
        unidad: m.item.unidadMedida,
        equivalencias: m.item.equivalencias,
        existenciaSistema: m.item.existencia,
        enTransito: m.enTransito,
        esperado: m.esperado,
        consumoTeorico: m.consumoTeorico,
      })),
    };
  }
}

export interface RegistrarCierreComando {
  fechaOperativa: Date;
  /** Lo contado de cada material: cantidad directa en su medida, o conteo como viene. */
  lineas: Array<{ itemId: string; cantidad?: number | null; conteo?: Conteo | null }>;
  observacion: string | null;
  usuarioId: string;
}

export class RegistrarCierreUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarCierreComando): Promise<CierreInventario> {
    if (comando.lineas.length > MAXIMO_LINEAS_CIERRE) {
      throw new DatosInventarioInvalidosError(`Un cierre admite máximo ${MAXIMO_LINEAS_CIERRE} materiales.`);
    }
    const observacion = comando.observacion?.trim() || null;
    if (observacion && observacion.length > 500) throw new DatosInventarioInvalidosError('La observación: máximo 500 caracteres.');
    const momento = await momentoOperativo(this.reloj, this.horarios);
    const fecha = comando.fechaOperativa.toISOString().slice(0, 10);

    return this.uow.ejecutar(async (ctx) => {
      // 1. Lecturas (regla de Firestore), con los materiales bloqueados.
      const { materiales, existente } = await leerSituacion(ctx, comando.fechaOperativa, true);
      if (existente) throw new CierreYaRegistradoError(`El día ${fecha} ya tiene cierre. Una corrección posterior se hace con un ajuste.`);
      if (materiales.length === 0) throw new DatosInventarioInvalidosError('No hay materiales que contar: ninguna receta vigente usa PI o insumos.');
      exigirCierreCompleto(materiales, comando.lineas.map((l) => l.itemId));
      const usuario = await ctx.usuarios.buscarPorId(comando.usuarioId);

      const porId = new Map(materiales.map((m) => [m.item.id, m]));
      const lineas = comando.lineas.map((l) => {
        const m = porId.get(l.itemId)!;
        if ((l.cantidad ?? null) === null && !l.conteo) throw new DatosInventarioInvalidosError(`${m.item.codigo}: falta lo contado.`);
        const convertido = l.conteo ? convertirConteo(l.conteo, m.item.equivalencias, m.item.unidadMedida, true) : null;
        return calcularLineaCierre(m, convertido?.total ?? l.cantidad!, convertido?.texto ?? null);
      });

      // 2. Escrituras: el cierre y, por cada merma o sobrante, su ajuste.
      const cierre = await ctx.cierresInventario.crear({
        fechaOperativa: comando.fechaOperativa,
        fechaHoraRegistro: momento.fechaHoraRegistro,
        usuarioId: comando.usuarioId,
        usuarioNombre: usuario?.nombre ?? comando.usuarioId,
        observacion,
        lineas: lineas.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      });
      for (const linea of cierre.lineas) {
        if (linea.merma === 0) continue;
        const m = porId.get(linea.itemId)!;
        // Existencia → contado + en tránsito (las pendientes descontarán al aprobarse).
        const ajuste = aplicarMovimiento(
          m.item.existencia,
          {
            tipo: 'AJUSTE',
            cantidad: -linea.merma,
            referencia: `Cierre ${fecha}`,
            observacion: null,
            motivo: linea.merma > 0 ? `Cierre del día ${fecha}: merma de ${linea.merma} ${linea.unidad}` : `Cierre del día ${fecha}: sobrante de ${-linea.merma} ${linea.unidad}`,
          },
          linea.unidad,
        );
        await ctx.movimientosInventario.crear({
          itemId: linea.itemId,
          tipo: 'AJUSTE',
          cantidad: ajuste.cantidad,
          saldo: ajuste.saldo,
          ...momento,
          usuarioId: comando.usuarioId,
          usuarioNombre: cierre.usuarioNombre,
          referencia: ajuste.datos.referencia,
          observacion: null,
          motivo: ajuste.datos.motivo,
          entradaId: null,
          remisionId: null,
          conteoTexto: linea.conteoTexto,
          cierreId: cierre.id,
        });
        await ctx.itemsInventario.fijarExistencia(linea.itemId, ajuste.saldo);
      }
      await ctx.auditoria.registrar({ entidad: 'cierre_inventario', entidadId: cierre.id, accion: 'CREAR', valorNuevo: cierre, usuarioId: comando.usuarioId });
      return cierre;
    });
  }
}
