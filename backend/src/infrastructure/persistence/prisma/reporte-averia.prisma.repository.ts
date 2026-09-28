/**
 * REPORTES DE AVERÍAS — Implementación con Prisma
 * ===============================================
 *
 * Tres tablas: `reporte_averia` → `registro_averia` → `evidencia_averia`.
 * Los enums de Prisma se traducen con un Record explícito: si alguien
 * agrega un valor en un solo lado, TypeScript lo reporta.
 */

import type {
  EstadoReporteAveria as EstadoPrisma,
  Prisma,
  TipoEvidenciaAveria as TipoPrisma,
  UnidadMedidaAveria as UnidadPrisma,
} from '../../../generated/prisma/client.js';
import type { TipoEvidencia, UnidadMedidaAveria } from '../../../domain/averia/registro-averia.js';
import type {
  EstadoReporteAveria,
  FiltroReportesAveria,
  NuevoReporteAveria,
  RegistroAveria,
  ReporteAveria,
  ReporteAveriaRepository,
} from '../../../domain/averia/reporte-averia.js';
import type { ClientePrisma } from './cliente-prisma.js';

const ESTADO: Record<EstadoPrisma, EstadoReporteAveria> = { REGISTRADO: 'REGISTRADO', ANULADO: 'ANULADO' };
const UNIDAD: Record<UnidadPrisma, UnidadMedidaAveria> = { UNIDAD: 'UNIDAD', DOCENA: 'DOCENA', SIX: 'SIX', BOLSA: 'BOLSA' };
const TIPO: Record<TipoPrisma, TipoEvidencia> = { UNIDAD: 'UNIDAD', LOTE_FECHA: 'LOTE_FECHA', CONJUNTO: 'CONJUNTO' };

const INCLUIR = {
  registros: { orderBy: { orden: 'asc' }, include: { evidencias: true } },
} satisfies Prisma.ReporteAveriaInclude;

type FilaReporte = Prisma.ReporteAveriaGetPayload<{ include: typeof INCLUIR }>;

function aDominio(fila: FilaReporte): ReporteAveria {
  return {
    id: fila.id,
    fechaHoraRegistro: fila.fechaHoraRegistro,
    fechaOperativa: fila.fechaOperativa,
    turnoId: fila.turnoId,
    grupoId: fila.grupoId,
    reportadoPorId: fila.reportadoPorId,
    reportadoPorNombre: fila.reportadoPorNombre,
    estado: ESTADO[fila.estado],
    motivoAnulacion: fila.motivoAnulacion,
    anuladoPorId: fila.anuladoPorId,
    fechaAnulacion: fila.fechaAnulacion,
    registros: fila.registros.map(
      (r): RegistroAveria => ({
        id: r.id,
        productoId: r.productoId,
        productoCodigo: r.productoCodigo,
        productoDescripcion: r.productoDescripcion,
        fechaVencimiento: r.fechaVencimiento,
        lote: r.lote,
        causalId: r.causalId,
        cantidad: r.cantidad,
        unidadMedida: UNIDAD[r.unidadMedida],
        evidencias: r.evidencias.map((e) => ({ tipo: TIPO[e.tipo], ruta: e.ruta })),
      }),
    ),
  };
}

/** Campos editables de un registro (las fotos y el producto de origen se manejan aparte). */
function camposRegistro(r: Omit<RegistroAveria, 'id' | 'evidencias'>) {
  return {
    productoId: r.productoId,
    productoCodigo: r.productoCodigo,
    productoDescripcion: r.productoDescripcion,
    fechaVencimiento: r.fechaVencimiento,
    lote: r.lote,
    causalId: r.causalId,
    cantidad: r.cantidad,
    unidadMedida: r.unidadMedida,
  };
}

export class ReporteAveriaPrismaRepository implements ReporteAveriaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async crear(reporte: NuevoReporteAveria): Promise<ReporteAveria> {
    const fila = await this.cliente.reporteAveria.create({
      data: {
        fechaHoraRegistro: reporte.fechaHoraRegistro,
        fechaOperativa: reporte.fechaOperativa,
        turnoId: reporte.turnoId,
        grupoId: reporte.grupoId,
        reportadoPorId: reporte.reportadoPorId,
        reportadoPorNombre: reporte.reportadoPorNombre,
        estado: reporte.estado,
        registros: {
          create: reporte.registros.map((r, orden) => ({
            orden,
            ...camposRegistro(r),
            evidencias: { create: r.evidencias.map((e) => ({ tipo: e.tipo, ruta: e.ruta })) },
          })),
        },
      },
      include: INCLUIR,
    });
    return aDominio(fila);
  }

  async buscarPorId(id: string): Promise<ReporteAveria | null> {
    const fila = await this.cliente.reporteAveria.findUnique({ where: { id }, include: INCLUIR });
    return fila ? aDominio(fila) : null;
  }

  async listar(filtro: FiltroReportesAveria): Promise<ReporteAveria[]> {
    const filas = await this.cliente.reporteAveria.findMany({
      where: {
        fechaOperativa: { gte: filtro.desde, lte: filtro.hasta },
        ...(filtro.turnoId ? { turnoId: filtro.turnoId } : {}),
        ...(filtro.grupoId ? { grupoId: filtro.grupoId } : {}),
        ...(filtro.estado ? { estado: filtro.estado } : {}),
      },
      orderBy: { fechaHoraRegistro: 'desc' },
      include: INCLUIR,
    });
    return filas.map(aDominio);
  }

  async actualizar(reporte: ReporteAveria): Promise<ReporteAveria> {
    for (const r of reporte.registros) {
      await this.cliente.registroAveria.update({ where: { id: r.id }, data: camposRegistro(r) });
    }
    const fila = await this.cliente.reporteAveria.update({
      where: { id: reporte.id },
      data: {
        estado: reporte.estado,
        motivoAnulacion: reporte.motivoAnulacion,
        anuladoPorId: reporte.anuladoPorId,
        fechaAnulacion: reporte.fechaAnulacion,
      },
      include: INCLUIR,
    });
    return aDominio(fila);
  }
}
