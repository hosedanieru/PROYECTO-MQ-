/**
 * DOBLES EN MEMORIA DEL MÓDULO MFR
 * ================================
 */

import type {
  AsignacionLinea,
  AsignacionRepository,
  DatosAsignacion,
} from '../../domain/mfr/asignacion-linea.js';
import type {
  AsistenciaRepository,
  AsistenciaTurno,
  DatosAsistencia,
} from '../../domain/mfr/asistencia-turno.js';
import {
  BloqueProgramacion,
  type BloqueRepository,
} from '../../domain/mfr/bloque-programacion.js';
import type {
  DatosEstandar,
  EstandarProducto,
  EstandarRepository,
} from '../../domain/mfr/estandar-produccion.js';
import type { DatosGrupo, Grupo, GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import type { HorarioRepository, HorarioTurno } from '../../domain/mfr/horas-turno.js';
import type {
  DatosLinea,
  LineaProduccion,
  LineaRepository,
} from '../../domain/mfr/linea-produccion.js';

const mismaFecha = (a: Date, b: Date) => a.getTime() === b.getTime();

export class LineaRepositorioFalso implements LineaRepository {
  readonly items: LineaProduccion[] = [];
  private secuencia = 0;

  agregar(linea: LineaProduccion): void {
    this.items.push(linea);
  }

  listar(): Promise<LineaProduccion[]> {
    return Promise.resolve([...this.items]);
  }

  buscarPorId(id: string): Promise<LineaProduccion | null> {
    return Promise.resolve(this.items.find((l) => l.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<LineaProduccion | null> {
    return Promise.resolve(this.items.find((l) => l.codigo === codigo) ?? null);
  }

  crear(datos: DatosLinea): Promise<LineaProduccion> {
    const nueva = { ...datos, id: `linea-${++this.secuencia}`, activo: true };
    this.items.push(nueva);
    return Promise.resolve(nueva);
  }

  actualizar(id: string, cambios: Partial<DatosLinea> & { activo?: boolean }): Promise<LineaProduccion> {
    const i = this.items.findIndex((l) => l.id === id);
    this.items[i] = { ...this.items[i], ...cambios };
    return Promise.resolve(this.items[i]);
  }
}

export class BloqueRepositorioFalso implements BloqueRepository {
  readonly items = new Map<string, BloqueProgramacion>();
  private secuencia = 0;

  listarPorFecha(fechaOperativa: Date): Promise<BloqueProgramacion[]> {
    // Copias, como devolvería la base: mutar el resultado no toca lo guardado.
    return Promise.resolve(
      [...this.items.values()]
        .filter((b) => mismaFecha(b.aObjeto().fechaOperativa, fechaOperativa))
        .map((b) => BloqueProgramacion.desdePersistencia(b.aObjeto())),
    );
  }

  buscarPorId(id: string): Promise<BloqueProgramacion | null> {
    const b = this.items.get(id);
    return Promise.resolve(b ? BloqueProgramacion.desdePersistencia(b.aObjeto()) : null);
  }

  crear(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    const persistido = BloqueProgramacion.desdePersistencia({ ...bloque.aObjeto(), id: `blq-${++this.secuencia}` });
    this.items.set(persistido.id, persistido);
    return Promise.resolve(persistido);
  }

  actualizar(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    this.items.set(bloque.id, BloqueProgramacion.desdePersistencia(bloque.aObjeto()));
    return Promise.resolve(bloque);
  }

  eliminar(id: string): Promise<void> {
    this.items.delete(id);
    return Promise.resolve();
  }
}

export class EstandarRepositorioFalso implements EstandarRepository {
  readonly items: EstandarProducto[] = [];

  agregar(e: EstandarProducto): void {
    this.items.push(e);
  }

  listar(): Promise<EstandarProducto[]> {
    return Promise.resolve([...this.items]);
  }

  buscarPorProducto(productoId: string): Promise<EstandarProducto | null> {
    return Promise.resolve(this.items.find((e) => e.productoId === productoId) ?? null);
  }

  actualizar(productoId: string, datos: DatosEstandar): Promise<EstandarProducto> {
    const i = this.items.findIndex((e) => e.productoId === productoId);
    this.items[i] = { ...this.items[i], ...datos };
    return Promise.resolve(this.items[i]);
  }
}

export class HorarioRepositorioFalso implements HorarioRepository {
  constructor(readonly horarios: HorarioTurno[] = []) {}

  vigentesEn(): Promise<HorarioTurno[]> {
    return Promise.resolve([...this.horarios]);
  }
}

/**
 * Programa un bloque de 06:00 a 13:30 (T1) cuyo target sea exactamente
 * `targetCajas` (E = 100 %, cajas/h = target ÷ 7,5). Sirve para que las
 * pruebas de remisiones tengan "lo que PepsiCo pidió" sin armar un DPP
 * entero.
 */
export async function programarTarget(
  bloques: BloqueRepositorioFalso,
  fechaOperativa: Date,
  productoId: string,
  targetCajas: number,
  lineaId = 'L1',
): Promise<BloqueProgramacion> {
  const horas = 7.5;
  const cajasPorHora = targetCajas / horas;
  return bloques.crear(
    BloqueProgramacion.crear(
      { fechaOperativa, lineaId, productoId, horaInicio: '06:00', horaFin: '13:30', cajasPorHora, eficienciaPorcentaje: 100, loop: null, personasAsignadas: null },
      'T1',
      'MANUAL',
      'coord',
      fechaOperativa,
    ),
  );
}

export class GrupoRepositorioFalso implements GrupoRepository {
  readonly items: Grupo[] = [];
  private secuencia = 0;

  agregar(grupo: Grupo): void {
    this.items.push(grupo);
  }

  listar(): Promise<Grupo[]> {
    return Promise.resolve([...this.items]);
  }

  buscarPorId(id: string): Promise<Grupo | null> {
    return Promise.resolve(this.items.find((g) => g.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<Grupo | null> {
    return Promise.resolve(this.items.find((g) => g.codigo === codigo) ?? null);
  }

  crear(datos: DatosGrupo): Promise<Grupo> {
    const nuevo = { ...datos, id: `grupo-${++this.secuencia}`, activo: true };
    this.items.push(nuevo);
    return Promise.resolve(nuevo);
  }

  actualizar(id: string, cambios: Partial<DatosGrupo> & { activo?: boolean }): Promise<Grupo> {
    const i = this.items.findIndex((g) => g.id === id);
    this.items[i] = { ...this.items[i], ...cambios };
    return Promise.resolve(this.items[i]);
  }
}

export class AsistenciaRepositorioFalso implements AsistenciaRepository {
  readonly items: AsistenciaTurno[] = [];

  listarPorFecha(fechaOperativa: Date): Promise<AsistenciaTurno[]> {
    return Promise.resolve(this.items.filter((a) => mismaFecha(a.fechaOperativa, fechaOperativa)));
  }

  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, grupoId: string): Promise<AsistenciaTurno | null> {
    return Promise.resolve(
      this.items.find((a) => mismaFecha(a.fechaOperativa, fechaOperativa) && a.turnoId === turnoId && a.grupoId === grupoId) ?? null,
    );
  }

  async guardar(datos: DatosAsistencia, registradaPorId: string, momento: Date): Promise<AsistenciaTurno> {
    const anterior = await this.buscarPorIdentidad(datos.fechaOperativa, datos.turnoId, datos.grupoId);
    const guardada: AsistenciaTurno = {
      id: anterior?.id ?? `asis-${this.items.length + 1}`,
      ...datos,
      registradaPorId,
      fechaRegistro: momento,
    };
    if (anterior) this.items[this.items.indexOf(anterior)] = guardada;
    else this.items.push(guardada);
    return guardada;
  }
}

export class AsignacionRepositorioFalso implements AsignacionRepository {
  readonly items: AsignacionLinea[] = [];
  private secuencia = 0;

  listarPorFecha(fechaOperativa: Date): Promise<AsignacionLinea[]> {
    return Promise.resolve(this.items.filter((a) => mismaFecha(a.fechaOperativa, fechaOperativa)));
  }

  buscarPorId(id: string): Promise<AsignacionLinea | null> {
    return Promise.resolve(this.items.find((a) => a.id === id) ?? null);
  }

  buscarPorIdentidad(fechaOperativa: Date, turnoId: string, lineaId: string, grupoId: string): Promise<AsignacionLinea | null> {
    return Promise.resolve(
      this.items.find(
        (a) => mismaFecha(a.fechaOperativa, fechaOperativa) && a.turnoId === turnoId && a.lineaId === lineaId && a.grupoId === grupoId,
      ) ?? null,
    );
  }

  async guardar(datos: DatosAsignacion, registradaPorId: string, momento: Date): Promise<AsignacionLinea> {
    const anterior = await this.buscarPorIdentidad(datos.fechaOperativa, datos.turnoId, datos.lineaId, datos.grupoId);
    const guardada: AsignacionLinea = { id: anterior?.id ?? `asig-${++this.secuencia}`, ...datos, registradaPorId, fechaRegistro: momento };
    if (anterior) this.items[this.items.indexOf(anterior)] = guardada;
    else this.items.push(guardada);
    return guardada;
  }

  eliminar(id: string): Promise<void> {
    const i = this.items.findIndex((a) => a.id === id);
    if (i >= 0) this.items.splice(i, 1);
    return Promise.resolve();
  }
}

/** Horarios del DPP de PepsiCo para todos los días de la semana. */
export function horariosDpp(): HorarioTurno[] {
  const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
  return dias.flatMap((diaSemana) => [
    { turnoId: 'T1', diaSemana, horaInicio: '06:00', horaFin: '13:30', cruzaMedianoche: false },
    { turnoId: 'T2', diaSemana, horaInicio: '14:00', horaFin: '21:30', cruzaMedianoche: false },
    { turnoId: 'T3', diaSemana, horaInicio: '22:00', horaFin: '05:30', cruzaMedianoche: true },
  ]);
}
