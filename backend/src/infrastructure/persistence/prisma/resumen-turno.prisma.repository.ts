/**
 * RESUMEN DEL TURNO — Implementación con Prisma
 * =============================================
 *
 * Tabla `resumen_turno`; los datos (la foto) en una columna JSONB.
 * Consecutivo en la tabla `consecutivo` con los tipos RESUMEN_TURNO y
 * RESUMEN_DIA, bloqueado con FOR UPDATE como el de las remisiones.
 */

import type { Prisma } from '../../../generated/prisma/client.js';
import type {
  DatosResumen,
  NuevoResumen,
  ResumenTurno,
  ResumenTurnoRepository,
  TipoResumen,
} from '../../../domain/resumen/resumen-turno.js';
import type { ClientePrisma } from './cliente-prisma.js';

const TIPO_CONSECUTIVO: Record<TipoResumen, string> = { TURNO: 'RESUMEN_TURNO', DIA: 'RESUMEN_DIA' };

export class ResumenTurnoPrismaRepository implements ResumenTurnoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async siguienteNumero(tipo: TipoResumen, anio: number): Promise<number> {
    const clave = TIPO_CONSECUTIVO[tipo];
    await this.cliente.$executeRaw`
      INSERT INTO consecutivo (id, tipo, anio, ultimo)
      VALUES (gen_random_uuid(), ${clave}, ${anio}, 0)
      ON CONFLICT (tipo, anio) DO NOTHING
    `;
    const filas = await this.cliente.$queryRaw<Array<{ ultimo: number }>>`
      SELECT ultimo FROM consecutivo WHERE tipo = ${clave} AND anio = ${anio} FOR UPDATE
    `;
    if (filas.length === 0) throw new Error(`No se pudo reservar el consecutivo ${clave} de ${anio}.`);
    return Number(filas[0].ultimo) + 1;
  }

  async crear(resumen: NuevoResumen, numero: number): Promise<ResumenTurno> {
    await this.cliente.$executeRaw`
      UPDATE consecutivo SET ultimo = ${numero} WHERE tipo = ${TIPO_CONSECUTIVO[resumen.tipo]} AND anio = ${resumen.anio}
    `;
    const fila = await this.cliente.resumenTurno.create({
      data: {
        tipo: resumen.tipo,
        anio: resumen.anio,
        numero,
        fechaOperativa: resumen.fechaOperativa,
        turnoId: resumen.turnoId,
        formatoCodigo: resumen.formato.codigo,
        formatoVersion: resumen.formato.version,
        formatoVigencia: resumen.formato.vigencia,
        datos: resumen.datos as unknown as Prisma.InputJsonValue,
        cerradoPorId: resumen.cerradoPorId,
        cerradoPorNombre: resumen.cerradoPorNombre,
        fechaHora: resumen.fechaHora,
      },
    });
    return aDominio(fila);
  }

  async buscarPorId(id: string): Promise<ResumenTurno | null> {
    const fila = await this.cliente.resumenTurno.findUnique({ where: { id } });
    return fila ? aDominio(fila) : null;
  }

  async listarPorFecha(fechaOperativa: Date): Promise<ResumenTurno[]> {
    const filas = await this.cliente.resumenTurno.findMany({ where: { fechaOperativa }, orderBy: { fechaHora: 'asc' } });
    return filas.map(aDominio);
  }
}

type FilaResumen = Prisma.ResumenTurnoGetPayload<object>;

function aDominio(f: FilaResumen): ResumenTurno {
  return {
    id: f.id,
    tipo: f.tipo as TipoResumen,
    anio: f.anio,
    numero: f.numero,
    fechaOperativa: f.fechaOperativa,
    turnoId: f.turnoId,
    formato: { codigo: f.formatoCodigo, version: f.formatoVersion, vigencia: f.formatoVigencia },
    datos: f.datos as unknown as DatosResumen,
    cerradoPorId: f.cerradoPorId,
    cerradoPorNombre: f.cerradoPorNombre,
    fechaHora: f.fechaHora,
  };
}
