/**
 * BLOQUE DE PROGRAMACIÓN (DPP)
 * ============================
 *
 * La unidad del schedule de PepsiCo ("SCHEDULE WM OMEGA", GDPP508P):
 * en una LÍNEA, de una HORA a otra, se corre un PRODUCTO a un ritmo de
 * CAJAS POR HORA con una eficiencia esperada. Un día operativo es la
 * lista de bloques de todas las líneas. Ejemplo del DPP del 2026-09-16:
 *
 *   L1  06:00–13:30  SURT MG LNC 586GX4X1  150 cajas/h  E 0,87  → Mx 1.125, T 979
 *
 * Decisión del área (2026-09-19): el ritmo se maneja en CAJAS POR HORA,
 * no en bolsas por minuto (el BPM del PDF se convierte al importar:
 * cajas/h = Mx ÷ horas del bloque).
 *
 * De cada bloque se derivan (ver `calculo-mfr.ts`):
 *   Mx = cajasPorHora × horas     capacidad máxima, cajas
 *   T  = Mx × E                   target, cajas
 *
 * Reemplaza a la "programación por SKU" y a la "configuración de turno"
 * del diseño anterior (2026-09-17): el bloque es a la vez la meta de
 * PepsiCo (T) y la configuración de la línea. Decisión del 2026-09-18.
 *
 * Gobierno:
 *   - corregir o eliminar un bloque existente exige motivo (auditado);
 *   - cerrar el turno congela sus bloques: `cerrar` es irreversible y
 *     `editar` falla después;
 *   - el turno del bloque se deriva de su hora de inicio (caso de uso),
 *     no lo elige el usuario.
 *
 * Identidad: el id. Dos bloques de la misma línea no pueden solaparse
 * en el tiempo (`verificarSinSolapamiento`).
 */

import { esHoraValida, horasDeHorario, minutosOperativos } from './horas-turno.js';
import { BloquesSolapadosError, DatosMfrInvalidosError, TurnoCerradoError } from './mfr.errors.js';

export const EFICIENCIA_MINIMA = 1;
export const EFICIENCIA_MAXIMA = 100;

export const ORIGENES_BLOQUE = ['MANUAL', 'DPP', 'COPIA'] as const;
export type OrigenBloque = (typeof ORIGENES_BLOQUE)[number];

export interface DatosBloque {
  fechaOperativa: Date;
  lineaId: string;
  productoId: string;
  /** "HH:mm" del reloj; el fin puede ser menor que el inicio (cruza la medianoche). */
  horaInicio: string;
  horaFin: string;
  /** Ritmo de la línea con ese producto al 100 %. */
  cajasPorHora: number;
  /** Eficiencia esperada en porcentaje: el "E: 0.87" del DPP es 87. */
  eficienciaPorcentaje: number;
  /** Texto del DPP ("LOOP1"); sin lógica asociada. */
  loop: string | null;
  /** Dato interno de Inlotrans; PepsiCo no lo envía. */
  personasAsignadas: number | null;
}

export interface EstadoPersistidoBloque extends DatosBloque {
  id: string;
  /** Derivado de `horaInicio` con los horarios del día. */
  turnoId: string;
  origen: OrigenBloque;
  creadoPorId: string;
  fechaCreacion: Date;
  cerradoEn: Date | null;
  cerradoPorId: string | null;
}

export type CambiosBloque = Partial<
  Pick<DatosBloque, 'productoId' | 'horaInicio' | 'horaFin' | 'cajasPorHora' | 'eficienciaPorcentaje' | 'loop' | 'personasAsignadas'>
>;

export class BloqueProgramacion {
  private constructor(private estadoInterno: EstadoPersistidoBloque) {}

  static crear(
    datos: DatosBloque,
    turnoId: string,
    origen: OrigenBloque,
    creadoPorId: string,
    momento: Date,
  ): BloqueProgramacion {
    const validos = BloqueProgramacion.validar(datos);
    return new BloqueProgramacion({
      ...validos,
      id: '',
      turnoId,
      origen,
      creadoPorId,
      fechaCreacion: momento,
      cerradoEn: null,
      cerradoPorId: null,
    });
  }

  static desdePersistencia(estado: EstadoPersistidoBloque): BloqueProgramacion {
    return new BloqueProgramacion({ ...estado });
  }

  static validar(datos: DatosBloque): DatosBloque {
    const exigir = (condicion: boolean, mensaje: string): void => {
      if (!condicion) throw new DatosMfrInvalidosError(mensaje);
    };
    exigir(
      datos.fechaOperativa instanceof Date && !Number.isNaN(datos.fechaOperativa.getTime()),
      'La fecha operativa no es válida.',
    );
    exigir((datos.lineaId ?? '').length > 0, 'La línea es obligatoria.');
    exigir((datos.productoId ?? '').length > 0, 'El producto es obligatorio.');
    exigir(esHoraValida(datos.horaInicio ?? ''), 'La hora de inicio debe tener el formato HH:mm.');
    exigir(esHoraValida(datos.horaFin ?? ''), 'La hora de fin debe tener el formato HH:mm.');
    exigir(datos.horaInicio !== datos.horaFin, 'La hora de fin debe ser distinta de la de inicio.');
    exigir(
      minutosOperativos(datos.horaInicio) + horasDeHorario(datos) * 60 <= 24 * 60,
      'El bloque se sale del día operativo (06:00 a 06:00).',
    );
    exigir(
      Number.isFinite(datos.cajasPorHora) && datos.cajasPorHora > 0,
      'Las cajas por hora deben ser un número mayor que cero.',
    );
    exigir(
      Number.isFinite(datos.eficienciaPorcentaje) &&
        datos.eficienciaPorcentaje >= EFICIENCIA_MINIMA &&
        datos.eficienciaPorcentaje <= EFICIENCIA_MAXIMA,
      `La eficiencia esperada debe estar entre ${EFICIENCIA_MINIMA} y ${EFICIENCIA_MAXIMA} %.`,
    );
    const loop = datos.loop?.trim() || null;
    exigir(loop === null || loop.length <= 40, 'El loop no puede superar 40 caracteres.');
    exigir(
      datos.personasAsignadas === null ||
        datos.personasAsignadas === undefined ||
        (Number.isInteger(datos.personasAsignadas) && datos.personasAsignadas >= 0),
      'Las personas asignadas no pueden ser negativas.',
    );

    return {
      fechaOperativa: datos.fechaOperativa,
      lineaId: datos.lineaId,
      productoId: datos.productoId,
      horaInicio: datos.horaInicio,
      horaFin: datos.horaFin,
      cajasPorHora: datos.cajasPorHora,
      eficienciaPorcentaje: datos.eficienciaPorcentaje,
      loop,
      personasAsignadas: datos.personasAsignadas ?? null,
    };
  }

  /** Cambia el contenido del bloque, no su fecha ni su línea. `turnoId` se recalcula afuera. */
  editar(cambios: CambiosBloque, turnoId: string): void {
    if (this.estaCerrado) {
      throw new TurnoCerradoError();
    }
    const propuesto = BloqueProgramacion.validar({ ...this.estadoInterno, ...sinIndefinidos(cambios) });
    this.estadoInterno = { ...this.estadoInterno, ...propuesto, turnoId };
  }

  /** Congela el bloque. Irreversible. */
  cerrar(cerradoPorId: string, momento: Date): void {
    if (this.estaCerrado) {
      throw new TurnoCerradoError();
    }
    this.estadoInterno.cerradoEn = momento;
    this.estadoInterno.cerradoPorId = cerradoPorId;
  }

  get id(): string {
    return this.estadoInterno.id;
  }

  get estaCerrado(): boolean {
    return this.estadoInterno.cerradoEn !== null;
  }

  /** Duración en horas decimales (7,5 para 06:00–13:30). */
  get horas(): number {
    return horasDeHorario(this.estadoInterno);
  }

  aObjeto(): EstadoPersistidoBloque {
    return { ...this.estadoInterno };
  }
}

function sinIndefinidos<T extends object>(objeto: T): Partial<T> {
  return Object.fromEntries(Object.entries(objeto).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Inicio y fin en minutos operativos. */
export function rangoOperativo(b: Pick<DatosBloque, 'horaInicio' | 'horaFin'>): { inicio: number; fin: number } {
  const inicio = minutosOperativos(b.horaInicio);
  return { inicio, fin: inicio + horasDeHorario(b) * 60 };
}

/**
 * Dos bloques de la misma línea no pueden compartir minutos. Se llama
 * con TODOS los bloques del día (los existentes más el nuevo o editado).
 */
export function verificarSinSolapamiento(bloques: EstadoPersistidoBloque[]): void {
  const porLinea = new Map<string, EstadoPersistidoBloque[]>();
  for (const b of bloques) {
    porLinea.set(b.lineaId, [...(porLinea.get(b.lineaId) ?? []), b]);
  }
  for (const [lineaId, lista] of porLinea) {
    const ordenados = [...lista].sort((a, b) => rangoOperativo(a).inicio - rangoOperativo(b).inicio);
    for (let i = 1; i < ordenados.length; i++) {
      const anterior = ordenados[i - 1];
      const actual = ordenados[i];
      if (rangoOperativo(actual).inicio < rangoOperativo(anterior).fin) {
        throw new BloquesSolapadosError(lineaId, anterior, actual);
      }
    }
  }
}

/** Orden natural de los bloques: por línea (según `ordenLineas`) y hora de inicio. */
export function ordenarBloques<T extends Pick<DatosBloque, 'lineaId' | 'horaInicio'>>(
  bloques: T[],
  ordenLineas: (lineaId: string) => number,
): T[] {
  return [...bloques].sort(
    (a, b) => ordenLineas(a.lineaId) - ordenLineas(b.lineaId) || minutosOperativos(a.horaInicio) - minutosOperativos(b.horaInicio),
  );
}

export interface BloqueRepository {
  listarPorFecha(fechaOperativa: Date): Promise<BloqueProgramacion[]>;
  buscarPorId(id: string): Promise<BloqueProgramacion | null>;
  crear(bloque: BloqueProgramacion): Promise<BloqueProgramacion>;
  actualizar(bloque: BloqueProgramacion): Promise<BloqueProgramacion>;
  eliminar(id: string): Promise<void>;
}

export const BLOQUE_REPOSITORY = Symbol('BloqueRepository');
