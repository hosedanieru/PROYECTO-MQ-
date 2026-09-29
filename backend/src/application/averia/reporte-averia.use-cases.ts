/**
 * CASOS DE USO: REPORTE DE AVERÍAS
 * ================================
 *
 *   CrearReporteAveriaUseCase     coordinador / patinador envían el reporte con sus fotos
 *   CorregirRegistroAveriaUseCase el administrador corrige un registro (no las fotos)
 *   AnularReporteAveriaUseCase    el administrador lo anula, con motivo
 *
 * Las fotos se guardan en el almacén ANTES de la transacción (el disco no
 * participa de ella). Si la transacción falla, se borran: así no quedan
 * fotos sin reporte. Todo lo demás, con su auditoría, es atómico.
 */

import {
  CausalNoEncontradaError,
  DatosAveriaInvalidosError,
  ReporteAveriaNoEncontradoError,
} from '../../domain/averia/averia.errors.js';
import { validarFoto, type AlmacenDeEvidencias, type ArchivoEvidencia } from '../../domain/averia/almacen-evidencias.js';
import {
  TIPOS_EVIDENCIA,
  validarCamposRegistro,
  type CamposRegistroAveria,
  type EvidenciaAveria,
  type TipoEvidencia,
} from '../../domain/averia/registro-averia.js';
import {
  anularReporte,
  exigirRegistrado,
  validarCantidadRegistros,
  type NuevoReporteAveria,
  type ReporteAveria,
} from '../../domain/averia/reporte-averia.js';
import { GrupoNoEncontradoError } from '../../domain/grupo/grupo.errors.js';
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';
import { momentoOperativo } from '../shared/momento-operativo.js';

const NOMBRE_FOTO: Record<TipoEvidencia, string> = {
  UNIDAD: 'Foto 1 (unidad)',
  LOTE_FECHA: 'Foto 2 (lote y fecha)',
  CONJUNTO: 'Foto 3 (conjunto)',
};

export interface RegistroNuevoAveria extends CamposRegistroAveria {
  fotos: Partial<Record<TipoEvidencia, ArchivoEvidencia>>;
}

export interface CrearReporteAveriaComando {
  grupoId: string;
  registros: RegistroNuevoAveria[];
  usuarioId: string;
}

export class CrearReporteAveriaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly almacen: AlmacenDeEvidencias,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: CrearReporteAveriaComando): Promise<ReporteAveria> {
    validarCantidadRegistros(comando.registros.length);
    if (!comando.grupoId?.trim()) {
      throw new DatosAveriaInvalidosError('El operador MQ (grupo) es obligatorio.');
    }

    // 1. Todo lo que se puede validar sin tocar el disco ni la base.
    const registros = comando.registros.map((r, i) =>
      conNumero(i, () => {
        const campos = validarCamposRegistro(r);
        for (const tipo of TIPOS_EVIDENCIA) {
          const foto = r.fotos[tipo];
          if (!foto) throw new DatosAveriaInvalidosError(`Falta la ${NOMBRE_FOTO[tipo].toLowerCase()}.`);
          validarFoto(foto, NOMBRE_FOTO[tipo]);
        }
        return { campos, fotos: r.fotos as Record<TipoEvidencia, ArchivoEvidencia> };
      }),
    );

    // 2. Fecha, hora y turno: automáticos (usuario, 2026-09-28).
    const { fechaHoraRegistro, fechaOperativa, turnoId } = await momentoOperativo(this.reloj, this.horarios);

    // 3. Fotos al almacén; si algo falla después, se borran.
    const guardadas: string[] = [];
    try {
      const conFotos: Array<{ campos: CamposRegistroAveria; evidencias: EvidenciaAveria[] }> = [];
      for (const r of registros) {
        const evidencias: EvidenciaAveria[] = [];
        for (const tipo of TIPOS_EVIDENCIA) {
          const ruta = await this.almacen.guardar(r.fotos[tipo]);
          guardadas.push(ruta);
          evidencias.push({ tipo, ruta });
        }
        conFotos.push({ campos: r.campos, evidencias });
      }

      // 4. Transacción: referencias vigentes, reporte y auditoría juntos.
      return await this.uow.ejecutar(async (ctx) => {
        const usuario = await ctx.usuarios.buscarPorId(comando.usuarioId);
        const grupo = await ctx.grupos.buscarPorId(comando.grupoId);
        if (!grupo || !grupo.activo) {
          throw new GrupoNoEncontradoError(`El grupo "${comando.grupoId}" no existe o está inactivo.`);
        }
        const snapshots = await resolverReferencias(ctx, conFotos.map((r) => r.campos));

        const nuevo: NuevoReporteAveria = {
          fechaHoraRegistro,
          fechaOperativa,
          turnoId,
          grupoId: grupo.id,
          reportadoPorId: comando.usuarioId,
          reportadoPorNombre: usuario?.nombre ?? comando.usuarioId,
          estado: 'REGISTRADO',
          motivoAnulacion: null,
          anuladoPorId: null,
          fechaAnulacion: null,
          registros: conFotos.map((r, i) => ({ ...r.campos, ...snapshots[i], evidencias: r.evidencias })),
        };
        const creado = await ctx.reportesAveria.crear(nuevo);
        await ctx.auditoria.registrar({
          entidad: 'reporte_averia',
          entidadId: creado.id,
          accion: 'CREAR',
          valorNuevo: creado,
          usuarioId: comando.usuarioId,
        });
        return creado;
      });
    } catch (error) {
      await Promise.allSettled(guardadas.map((ruta) => this.almacen.eliminar(ruta)));
      throw error;
    }
  }
}

export interface CorregirRegistroAveriaComando {
  reporteId: string;
  registroId: string;
  cambios: Partial<CamposRegistroAveria>;
  usuarioId: string;
}

export class CorregirRegistroAveriaUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CorregirRegistroAveriaComando): Promise<ReporteAveria> {
    return this.uow.ejecutar(async (ctx) => {
      const reporte = await buscarReporte(ctx, comando.reporteId);
      exigirRegistrado(reporte);
      const indice = reporte.registros.findIndex((r) => r.id === comando.registroId);
      if (indice < 0) {
        throw new ReporteAveriaNoEncontradoError(`El reporte no tiene el registro "${comando.registroId}".`);
      }
      const anterior = reporte.registros[indice];
      const cambios = Object.fromEntries(Object.entries(comando.cambios).filter(([, v]) => v !== undefined));
      const campos = validarCamposRegistro({ ...anterior, ...cambios });
      const [snapshot] = await resolverReferencias(ctx, [campos]);

      const corregido = { ...anterior, ...campos, ...snapshot };
      const registros = reporte.registros.map((r, i) => (i === indice ? corregido : r));
      const actualizado = await ctx.reportesAveria.actualizar({ ...reporte, registros });
      await ctx.auditoria.registrar({
        entidad: 'reporte_averia',
        entidadId: reporte.id,
        accion: 'ACTUALIZAR',
        valorAnterior: anterior,
        valorNuevo: corregido,
        usuarioId: comando.usuarioId,
      });
      return actualizado;
    });
  }
}

export interface AnularReporteAveriaComando {
  reporteId: string;
  motivo: string;
  usuarioId: string;
}

export class AnularReporteAveriaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: AnularReporteAveriaComando): Promise<ReporteAveria> {
    return this.uow.ejecutar(async (ctx) => {
      const reporte = await buscarReporte(ctx, comando.reporteId);
      const anulado = anularReporte(reporte, comando.motivo, comando.usuarioId, this.reloj.ahora());
      const guardado = await ctx.reportesAveria.actualizar(anulado);
      await ctx.auditoria.registrar({
        entidad: 'reporte_averia',
        entidadId: reporte.id,
        accion: 'CAMBIO_ESTADO',
        valorAnterior: { estado: reporte.estado },
        valorNuevo: { estado: anulado.estado },
        motivo: anulado.motivoAnulacion,
        usuarioId: comando.usuarioId,
      });
      return guardado;
    });
  }
}

// ---------- apoyo ----------

async function buscarReporte(ctx: ContextoTransaccional, id: string): Promise<ReporteAveria> {
  const reporte = await ctx.reportesAveria.buscarPorId(id);
  if (!reporte) throw new ReporteAveriaNoEncontradoError(`No existe el reporte de averías "${id}".`);
  return reporte;
}

/**
 * Verifica que producto y causal existan y estén activos, y
 * devuelve la copia congelada del producto de cada registro. Solo lee:
 * en Firestore todas las lecturas van antes de cualquier escritura.
 */
async function resolverReferencias(
  ctx: ContextoTransaccional,
  registros: CamposRegistroAveria[],
): Promise<Array<{ productoCodigo: string; productoDescripcion: string }>> {
  const productos = new Map<string, { codigo: string; descripcion: string }>();
  const causales = new Set<string>();

  const snapshots: Array<{ productoCodigo: string; productoDescripcion: string }> = [];
  for (const [i, r] of registros.entries()) {
    if (!productos.has(r.productoId)) {
      const p = await ctx.productos.buscarPorId(r.productoId);
      if (!p || !p.activo) {
        throw new ProductoNoEncontradoError(`Avería ${i + 1}: el producto no existe o está inactivo.`);
      }
      productos.set(r.productoId, p);
    }
    if (!causales.has(r.causalId)) {
      const c = await ctx.causales.buscarPorId(r.causalId);
      if (!c || !c.activo) {
        throw new CausalNoEncontradaError(`Avería ${i + 1}: la causal no existe o está inactiva.`);
      }
      causales.add(r.causalId);
    }
    const p = productos.get(r.productoId)!;
    snapshots.push({ productoCodigo: p.codigo, productoDescripcion: p.descripcion });
  }
  return snapshots;
}

/** Antepone "Avería N:" a los errores de datos, para que el formulario diga cuál fila corregir. */
function conNumero<T>(indice: number, validar: () => T): T {
  try {
    return validar();
  } catch (error) {
    if (error instanceof DatosAveriaInvalidosError) {
      throw new DatosAveriaInvalidosError(`Avería ${indice + 1}: ${error.message}`);
    }
    throw error;
  }
}
