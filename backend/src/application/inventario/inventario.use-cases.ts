/**
 * CASOS DE USO: INVENTARIO
 * ========================
 *
 *   RegistrarMovimientoUseCase        entrada, salida o ajuste, con su saldo
 *   RegistrarEntradaMercanciaUseCase  lo que llega en un documento: varias líneas, todo o nada
 *
 * El catálogo (PT, PI, insumos, unidades) está en `catalogo-inventario.use-cases.ts`.
 * Todo con auditoría dentro de la misma transacción.
 */

import {
  TIPOS_ITEM_ENTRADA,
  validarEntrada,
  type DatosEntrada,
  type EntradaMercancia,
} from '../../domain/inventario/entrada-mercancia.js';
import { redondear } from '../../domain/inventario/cantidad.js';
import { convertirConteo, type Conteo } from '../../domain/inventario/conteo.js';
import { DatosInventarioInvalidosError, ItemInventarioNoEncontradoError } from '../../domain/inventario/inventario.errors.js';
import type { ItemInventario } from '../../domain/inventario/item-inventario.js';
import {
  aplicarMovimiento,
  type DatosMovimiento,
  type MovimientoInventario,
} from '../../domain/inventario/movimiento-inventario.js';
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';
import { momentoOperativo } from '../shared/momento-operativo.js';

export interface RegistrarMovimientoComando extends DatosMovimiento {
  itemId: string;
  /**
   * Conteo mixto en lugar de `cantidad` (PI e insumos). En ENTRADA/SALIDA es
   * lo que entra o sale; en AJUSTE es lo que se CONTÓ físicamente, y el
   * ajuste es la diferencia con la existencia.
   */
  conteo?: Conteo | null;
  usuarioId: string;
}

/** Resuelve el conteo del comando a la cantidad del movimiento, con el texto de lo digitado. */
function resolverConteo(comando: RegistrarMovimientoComando, item: ItemInventario): { datos: DatosMovimiento; conteoTexto: string | null } {
  if (!comando.conteo) return { datos: comando, conteoTexto: null };
  if (item.tipo === 'PT') throw new DatosInventarioInvalidosError('El PT se mueve en cajas: use la cantidad.');
  const ajuste = comando.tipo === 'AJUSTE';
  const { total, texto } = convertirConteo(comando.conteo, item.equivalencias, item.unidadMedida, ajuste);
  return {
    datos: { ...comando, cantidad: ajuste ? redondear(total - item.existencia) : total },
    conteoTexto: ajuste ? `Conteo físico: ${texto}` : texto,
  };
}

export class RegistrarMovimientoUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarMovimientoComando): Promise<{ movimiento: MovimientoInventario; item: ItemInventario }> {
    // Fecha, hora y turno los pone el servidor, igual que en averías.
    const momento = await momentoOperativo(this.reloj, this.horarios);

    return this.uow.ejecutar(async ({ itemsInventario, movimientosInventario, usuarios, auditoria }) => {
      // Lecturas primero (regla de Firestore); el ítem queda bloqueado.
      const usuario = await usuarios.buscarPorId(comando.usuarioId);
      const item = await itemsInventario.bloquearParaMovimiento(comando.itemId);
      if (!item || !item.activo) {
        throw new ItemInventarioNoEncontradoError('El ítem de inventario no existe o está inactivo.');
      }

      const { datos, conteoTexto } = resolverConteo(comando, item);
      // El PT se mueve en cajas enteras; PI e insumos admiten decimales.
      const calculado = aplicarMovimiento(item.existencia, datos, item.unidadMedida, item.tipo === 'PT');
      const movimiento = await movimientosInventario.crear({
        itemId: item.id,
        tipo: calculado.datos.tipo,
        cantidad: calculado.cantidad,
        saldo: calculado.saldo,
        ...momento,
        usuarioId: comando.usuarioId,
        usuarioNombre: usuario?.nombre ?? comando.usuarioId,
        referencia: calculado.datos.referencia,
        observacion: calculado.datos.observacion,
        motivo: calculado.datos.motivo,
        entradaId: null,
        remisionId: null,
        conteoTexto,
        cierreId: null,
      });
      await itemsInventario.fijarExistencia(item.id, calculado.saldo);
      await auditoria.registrar({
        entidad: 'movimiento_inventario',
        entidadId: movimiento.id,
        accion: 'CREAR',
        valorAnterior: { existencia: item.existencia },
        valorNuevo: movimiento,
        motivo: movimiento.motivo,
        usuarioId: comando.usuarioId,
      });
      return { movimiento, item: { ...item, existencia: calculado.saldo } };
    });
  }
}

export interface RegistrarEntradaComando extends DatosEntrada {
  usuarioId: string;
}

export interface LineaEntradaRegistrada {
  movimientoId: string;
  itemId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  saldo: number;
  /** Lo que se digitó, si llegó como conteo ("10 ROLLO (1 ROLLO = 50 METRO)"). */
  conteoTexto: string | null;
}

export class RegistrarEntradaMercanciaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarEntradaComando): Promise<EntradaMercancia & { lineas: LineaEntradaRegistrada[] }> {
    const datos = validarEntrada(comando);
    const momento = await momentoOperativo(this.reloj, this.horarios);

    return this.uow.ejecutar(async ({ itemsInventario, movimientosInventario, entradasMercancia, usuarios, auditoria }) => {
      // 1. Lecturas (regla de Firestore). Los ítems se bloquean SIEMPRE en
      //    el mismo orden (por id): dos entradas simultáneas con los mismos
      //    ítems en otro orden se esperarían mutuamente (deadlock).
      const usuario = await usuarios.buscarPorId(comando.usuarioId);
      const items = new Map<string, ItemInventario>();
      for (const id of [...new Set(datos.lineas.map((l) => l.itemId))].sort()) {
        const item = await itemsInventario.bloquearParaMovimiento(id);
        if (item) items.set(id, item);
      }
      const calculadas = datos.lineas.map((l, i) => {
        const item = items.get(l.itemId);
        if (!item || !item.activo) {
          throw new ItemInventarioNoEncontradoError(`Línea ${i + 1}: el ítem no existe o está inactivo.`);
        }
        if (!TIPOS_ITEM_ENTRADA.includes(item.tipo)) {
          throw new DatosInventarioInvalidosError(`Línea ${i + 1}: ${item.codigo} es ${item.tipo}; la entrada de mercancía recibe insumos y PI.`);
        }
        // Lo que llega se puede digitar como viene (rollos, cajas…): se convierte a la medida.
        let conteo: { total: number; texto: string } | null = null;
        try {
          conteo = l.conteo ? convertirConteo(l.conteo, item.equivalencias, item.unidadMedida) : null;
        } catch (error) {
          if (error instanceof DatosInventarioInvalidosError) throw new DatosInventarioInvalidosError(`Línea ${i + 1} (${item.codigo}): ${error.message}`);
          throw error;
        }
        const calculo = aplicarMovimiento(
          item.existencia,
          { tipo: 'ENTRADA', cantidad: conteo?.total ?? l.cantidad!, referencia: datos.documento, observacion: null, motivo: null },
          item.unidadMedida,
        );
        return { item, calculo, conteoTexto: conteo?.texto ?? null };
      });

      // 2. Escrituras: encabezado, un movimiento por línea y existencias.
      const entrada = await entradasMercancia.crear({
        documento: datos.documento,
        remitente: datos.remitente,
        observacion: datos.observacion,
        ...momento,
        usuarioId: comando.usuarioId,
        usuarioNombre: usuario?.nombre ?? comando.usuarioId,
      });
      const lineas: LineaEntradaRegistrada[] = [];
      for (const { item, calculo, conteoTexto } of calculadas) {
        const movimiento = await movimientosInventario.crear({
          itemId: item.id,
          tipo: 'ENTRADA',
          cantidad: calculo.cantidad,
          saldo: calculo.saldo,
          ...momento,
          usuarioId: comando.usuarioId,
          usuarioNombre: entrada.usuarioNombre,
          referencia: datos.documento,
          observacion: null,
          motivo: null,
          entradaId: entrada.id,
          remisionId: null,
          conteoTexto,
          cierreId: null,
        });
        await itemsInventario.fijarExistencia(item.id, calculo.saldo);
        lineas.push({
          movimientoId: movimiento.id,
          itemId: item.id,
          codigo: item.codigo,
          descripcion: item.descripcion,
          unidadMedida: item.unidadMedida,
          cantidad: calculo.cantidad,
          saldo: calculo.saldo,
          conteoTexto,
        });
      }
      await auditoria.registrar({
        entidad: 'entrada_mercancia',
        entidadId: entrada.id,
        accion: 'CREAR',
        valorNuevo: { ...entrada, lineas },
        usuarioId: comando.usuarioId,
      });
      return { ...entrada, lineas };
    });
  }
}

