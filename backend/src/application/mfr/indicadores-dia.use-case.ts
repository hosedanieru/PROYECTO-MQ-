/**
 * CASO DE USO: INDICADORES DEL DÍA
 * ================================
 *
 * Reúne todo lo que el cálculo puro necesita para un día operativo y
 * devuelve el tablero: bloques calculados (Mx, T, kg), MFR por SKU
 * contra lo programado, resumen por turno y por línea, y la vista
 * horaria en kilogramos (las filas del DPP). Es una lectura: sin unidad
 * de trabajo ni auditoría.
 *
 * Solo cuentan las remisiones APROBADAS o VALIDADAS (decisión del área).
 */

import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import type { GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import {
  asignadasPorGrupo,
  evaluarLineasTurno,
  type AsignacionRepository,
  type PersonalLinea,
} from '../../domain/mfr/asignacion-linea.js';
import {
  evaluarPersonalTurno,
  type AsistenciaRepository,
  type PersonalGrupo,
  type PersonalTurno,
} from '../../domain/mfr/asistencia-turno.js';
import type { BloqueRepository } from '../../domain/mfr/bloque-programacion.js';
import { ordenarBloques } from '../../domain/mfr/bloque-programacion.js';
import {
  calcularBloques,
  calcularFamiliasHorarias,
  calcularLinea,
  calcularMfrDia,
  calcularTurno,
  calcularVistaHoraria,
  ESTADOS_QUE_CUENTAN,
  META_MFR_PORCENTAJE,
  type BloqueCalculado,
  type FilaFamilia,
  type MfrDia,
  type ResumenLinea,
  type ResumenTurno,
  type VistaHoraria,
} from '../../domain/mfr/calculo-mfr.js';
import type { EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import { horasTurnoEn, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import type { LineaProduccion, LineaRepository } from '../../domain/mfr/linea-produccion.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';

/** Personal del turno con grupos y líneas ya resueltos (código y nombre) para mostrar. */
export interface PersonalTurnoResuelto extends Omit<PersonalTurno, 'grupos'> {
  grupos: Array<PersonalGrupo & { codigo: string; nombre: string }>;
  lineas: Array<
    Omit<PersonalLinea, 'grupos'> & {
      codigo: string;
      nombre: string;
      grupos: Array<PersonalLinea['grupos'][number] & { codigo: string; nombre: string }>;
    }
  >;
}

export interface IndicadoresDia {
  fechaOperativa: Date;
  meta: number;
  bloques: BloqueCalculado[];
  mfr: MfrDia;
  turnos: Array<ResumenTurno & { codigo: string; nombre: string; horasTurno: number | null; personal: PersonalTurnoResuelto }>;
  lineas: Array<ResumenLinea & { codigo: string; nombre: string; tipo: LineaProduccion['tipo']; capacidadKgHora: number | null }>;
  horario: VistaHoraria;
  /** "Flavor Breakdown": kg target por hora agrupados por familia (SUBDESCRIPCION). */
  familias: FilaFamilia[];
  /** Lo que impide calcular por completo: productos sin peso neto por caja. */
  advertencias: string[];
}

export class IndicadoresDiaUseCase {
  constructor(
    private readonly bloques: BloqueRepository,
    private readonly lineas: LineaRepository,
    private readonly estandares: EstandarRepository,
    private readonly horarios: HorarioRepository,
    private readonly remisiones: RemisionRepository,
    private readonly catalogos: CatalogoRepository,
    private readonly asistencias: AsistenciaRepository,
    private readonly grupos: GrupoRepository,
    private readonly asignaciones: AsignacionRepository,
  ) {}

  async ejecutar(fechaOperativa: Date): Promise<IndicadoresDia> {
    const [bloquesDia, lineas, estandares, horarios, produccion, turnos, asistencias, grupos, asignaciones] = await Promise.all([
      this.bloques.listarPorFecha(fechaOperativa),
      this.lineas.listar(),
      this.estandares.listar(),
      this.horarios.vigentesEn(fechaOperativa),
      this.remisiones.totalizarCajas(fechaOperativa, ESTADOS_QUE_CUENTAN),
      this.catalogos.listarTurnos(),
      this.asistencias.listarPorFecha(fechaOperativa),
      this.grupos.listar(),
      this.asignaciones.listarPorFecha(fechaOperativa),
    ]);
    const grupoDe = new Map(grupos.map((g) => [g.id, g]));
    const lineaDe = new Map(lineas.map((l) => [l.id, l]));
    const nombreGrupo = (grupoId: string) => ({
      codigo: grupoDe.get(grupoId)?.codigo ?? grupoId,
      nombre: grupoDe.get(grupoId)?.nombre ?? grupoId,
    });

    const ordenDe = new Map(lineas.map((l) => [l.id, l.orden]));
    const bloques = ordenarBloques(
      calcularBloques(bloquesDia.map((b) => b.aObjeto()), estandares),
      (lineaId) => ordenDe.get(lineaId) ?? 999,
    );
    const mfr = calcularMfrDia(bloques, produccion, META_MFR_PORCENTAJE);

    const porTurno = turnos
      .filter((t) => t.activo)
      .map((t) => {
        const personal = evaluarPersonalTurno(t.id, asistencias, grupos, bloques, asignadasPorGrupo(t.id, asignaciones));
        const lineasTurno = evaluarLineasTurno(t.id, asignaciones, bloques, (lineaId) => ordenDe.get(lineaId) ?? 999);
        return {
          ...calcularTurno(t.id, bloques, produccion, estandares, META_MFR_PORCENTAJE),
          codigo: t.codigo,
          nombre: t.nombre,
          horasTurno: horasTurnoEn(horarios, t.id, fechaOperativa),
          personal: {
            ...personal,
            grupos: personal.grupos.map((g) => ({ ...g, ...nombreGrupo(g.grupoId) })),
            lineas: lineasTurno.map((l) => ({
              ...l,
              codigo: lineaDe.get(l.lineaId)?.codigo ?? l.lineaId,
              nombre: lineaDe.get(l.lineaId)?.nombre ?? l.lineaId,
              grupos: l.grupos.map((g) => ({ ...g, ...nombreGrupo(g.grupoId) })),
            })),
          },
        };
      });

    // Líneas activas, o inactivas que aun así tienen bloques ese día.
    const lineasDelDia = lineas
      .filter((l) => l.activo || bloques.some((b) => b.lineaId === l.id))
      .sort((a, b) => a.orden - b.orden || a.codigo.localeCompare(b.codigo));
    const porLinea = lineasDelDia.map((l) => ({
      ...calcularLinea(l.id, bloques),
      codigo: l.codigo,
      nombre: l.nombre,
      tipo: l.tipo,
      capacidadKgHora: l.capacidadKgHora,
    }));

    const estandarDe = new Map(estandares.map((e) => [e.productoId, e]));
    const advertencias = new Set<string>();
    for (const productoId of new Set(bloques.map((b) => b.productoId))) {
      const e = estandarDe.get(productoId);
      if (!e || e.pesoNetoKg === null) advertencias.add(`El producto ${e?.codigo ?? productoId} no tiene peso neto por caja: sin kilogramos.`);
    }

    return {
      fechaOperativa,
      meta: META_MFR_PORCENTAJE,
      bloques,
      mfr,
      turnos: porTurno,
      lineas: porLinea,
      horario: calcularVistaHoraria(bloques, lineasDelDia.map((l) => ({ id: l.id, capacidadKgHora: l.capacidadKgHora }))),
      familias: calcularFamiliasHorarias(bloques, estandares),
      advertencias: [...advertencias],
    };
  }
}
