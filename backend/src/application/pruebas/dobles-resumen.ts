import type { ConfiguracionResumen } from '../mfr/bloques.use-cases.js';
import type { PeticionCierre, ResumenesDelCierre } from '../resumen/armar-resumen.js';
import type {
  DatosResumen,
  GeneradorPdfResumen,
  NuevoResumen,
  ResumenTurno,
  ResumenTurnoRepository,
  TipoResumen,
} from '../../domain/resumen/resumen-turno.js';

/** Resúmenes en memoria, con un consecutivo por tipo y año. */
export class ResumenTurnoRepositorioFalso implements ResumenTurnoRepository {
  readonly resumenes: ResumenTurno[] = [];
  private readonly ultimos = new Map<string, number>();

  siguienteNumero(tipo: TipoResumen, anio: number): Promise<number> {
    return Promise.resolve((this.ultimos.get(`${tipo}-${anio}`) ?? 0) + 1);
  }

  crear(resumen: NuevoResumen, numero: number): Promise<ResumenTurno> {
    this.ultimos.set(`${resumen.tipo}-${resumen.anio}`, numero);
    const creado = { ...resumen, numero, id: `resumen-${this.resumenes.length + 1}` };
    this.resumenes.push(creado);
    return Promise.resolve(creado);
  }

  buscarPorId(id: string): Promise<ResumenTurno | null> {
    return Promise.resolve(this.resumenes.find((r) => r.id === id) ?? null);
  }

  listarPorFecha(fechaOperativa: Date): Promise<ResumenTurno[]> {
    return Promise.resolve(this.resumenes.filter((r) => r.fechaOperativa.getTime() === fechaOperativa.getTime()));
  }
}

/** Una foto mínima: lo que se prueba del cierre es que se guarde, no su contenido. */
export function datosResumen(titulo: string, novedades: DatosResumen['novedades'] = []): DatosResumen {
  return {
    titulo,
    horario: null,
    produccion: { programadoCajas: 0, producidoCajas: 0, cumplimiento: null, semaforo: null, porProducto: [], porLinea: [], faltantes: [], motivoFaltante: null, extraoficialesCajas: 0 },
    remisiones: { porEstado: {}, lista: [] },
    personal: { requeridasDpp: 0, llegaron: 0, coberturaDpp: null, estado: 'SIN_DATO', grupos: [] },
    averias: { unidades: 0, porcentaje: null, maximoPorcentaje: 1, excede: false, porCausal: [] },
    inventario: { consumo: [], alertas: [] },
    novedades,
  };
}

/**
 * Armador que no lee nada. Igual que el real, propone el resumen del día
 * cuando cree que es el último turno (`terminaElDia`); el cierre decide.
 */
export function armadorFalso(terminaElDia = false): ConfiguracionResumen {
  return {
    formato: { codigo: null, version: null, vigencia: null },
    armador: {
      prepararCierre: (p: PeticionCierre): Promise<ResumenesDelCierre> =>
        Promise.resolve({
          turno: datosResumen(p.turnoId, [{ turno: p.turnoId, texto: p.novedades }]),
          dia: terminaElDia ? datosResumen('Día operativo completo', [{ turno: p.turnoId, texto: p.novedades }]) : null,
        }),
    },
  };
}

export class GeneradorPdfResumenFalso implements GeneradorPdfResumen {
  generar(resumen: ResumenTurno): Promise<Buffer> {
    return Promise.resolve(Buffer.from(`PDF ${resumen.tipo} ${resumen.numero}`));
  }
}
