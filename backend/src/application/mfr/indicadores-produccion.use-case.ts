/**
 * CASOS DE USO: INDICADORES DE PRODUCCIÓN (Ciclo 2, fase 1)
 * =========================================================
 *
 * Reúnen lo que el cálculo puro necesita y se lo entregan al dominio:
 *
 *   IndicadoresPeriodoUseCase   FR, OTIF, averías vs lo fabricado,
 *                               ranking de PT y productividad de un periodo
 *                               (día, 7 días o mes: lo decide quien llama)
 *   RitmoDiaUseCase             ritmo por hora de un día (adelantado, en
 *                               línea, retrasado), por turno
 *
 * Solo leen: sin unidad de trabajo ni auditoría. No hay datos nuevos en
 * la base: todo sale de bloques del DPP, remisiones, reportes de averías
 * y asistencia, que ya se guardan.
 *
 * Definiciones: `domain/mfr/indicadores-produccion.ts` y
 * `domain/mfr/ritmo-produccion.ts` (acordadas con el usuario el 2026-10-06).
 */

import type { ReporteAveriaRepository } from '../../domain/averia/reporte-averia.js';
import type { CatalogoRepository } from '../../domain/catalogo/catalogo.repository.js';
import type { GrupoRepository } from '../../domain/grupo/grupo.repository.js';
import type { AsistenciaRepository } from '../../domain/mfr/asistencia-turno.js';
import { rangoOperativo, type BloqueRepository, type EstadoPersistidoBloque } from '../../domain/mfr/bloque-programacion.js';
import { calcularBloque } from '../../domain/mfr/calculo-mfr.js';
import { horasTurnoEn, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import {
  calcularAveriasVsFabricado,
  calcularFr,
  calcularOtif,
  calcularProductividad,
  calcularRankingPt,
  type AveriasVsFabricado,
  type BloqueIndicador,
  type Fr,
  type Otif,
  type Productividad,
  type RankingPt,
  type RemisionIndicador,
} from '../../domain/mfr/indicadores-produccion.js';
import { calcularRitmo, type RitmoDia } from '../../domain/mfr/ritmo-produccion.js';
import type { ProductoRepository } from '../../domain/producto/producto.repository.js';
import type { Remision } from '../../domain/remision/remision.entity.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import { diasDelRango, validarRango } from '../../domain/shared/rango-fechas.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';

const dia = (fecha: Date) => fecha.toISOString().slice(0, 10);

/** Nombre para mostrar de un producto, turno o grupo. */
interface Nombre {
  codigo: string;
  nombre: string;
}

export interface IndicadoresPeriodo {
  desde: string;
  hasta: string;
  fr: Fr;
  otif: Otif;
  averiasVsFabricado: AveriasVsFabricado;
  ranking: RankingPt;
  productividad: Productividad;
  /** Para mostrar: código y descripción de cada PT, código y nombre de turnos y grupos. */
  productos: Record<string, Nombre>;
  turnos: Record<string, Nombre>;
  grupos: Record<string, Nombre>;
}

export interface RitmoDiaResultado extends RitmoDia {
  fechaOperativa: string;
  turnos: Record<string, Nombre>;
}

function aIndicador(b: EstadoPersistidoBloque): BloqueIndicador {
  return {
    fechaOperativa: dia(b.fechaOperativa),
    turnoId: b.turnoId,
    productoId: b.productoId,
    finMinutos: rangoOperativo(b).fin,
    // El peso no hace falta aquí: solo el T en cajas.
    targetCajas: calcularBloque(b, undefined).targetCajas,
  };
}

function remisionIndicador(r: Remision): RemisionIndicador {
  const d = r.aObjeto();
  return {
    fechaOperativa: dia(d.fechaOperativa),
    turnoId: d.turnoId,
    grupoId: d.grupoId,
    productoId: d.productoId,
    cajas: d.cantidadCajas,
    unidades: d.cantidadUnidades,
    estado: d.estado,
    extraoficial: d.extraoficial,
    creada: d.fechaHoraRegistro,
    aprobada: d.fechaAprobacion ?? null,
  };
}

const nombres = <T extends { id: string; codigo: string }>(lista: T[], nombre: (x: T) => string): Record<string, Nombre> =>
  Object.fromEntries(lista.map((x) => [x.id, { codigo: x.codigo, nombre: nombre(x) }]));

export class IndicadoresPeriodoUseCase {
  constructor(
    private readonly bloques: BloqueRepository,
    private readonly remisiones: RemisionRepository,
    private readonly reportes: ReporteAveriaRepository,
    private readonly asistencias: AsistenciaRepository,
    private readonly horarios: HorarioRepository,
    private readonly productos: ProductoRepository,
    private readonly catalogos: CatalogoRepository,
    private readonly grupos: GrupoRepository,
  ) {}

  async ejecutar(desde: Date, hasta: Date): Promise<IndicadoresPeriodo> {
    validarRango(desde, hasta);
    const dias = diasDelRango(desde, hasta);

    const [bloquesPorDia, remisiones, reportes, asistenciasPorDia, horariosPorDia, productos, turnos, grupos] = await Promise.all([
      Promise.all(dias.map((d) => this.bloques.listarPorFecha(d))),
      this.remisiones.listarTodas({ fechaOperativaDesde: desde, fechaOperativaHasta: hasta }),
      this.reportes.listar({ desde, hasta }),
      Promise.all(dias.map((d) => this.asistencias.listarPorFecha(d))),
      Promise.all(dias.map((d) => this.horarios.vigentesEn(d))),
      this.productos.listar({}),
      this.catalogos.listarTurnos(),
      this.grupos.listar(),
    ]);

    const bloques = bloquesPorDia.flat().map((b) => aIndicador(b.aObjeto()));
    const rems = remisiones.map(remisionIndicador);
    const asistencias = asistenciasPorDia.flat().map((a) => ({
      fechaOperativa: dia(a.fechaOperativa),
      turnoId: a.turnoId,
      grupoId: a.grupoId,
      personas: a.personasLlegaron,
    }));
    // Horas productivas de cada turno cada día: salen de `turno_horario` (7,5 h con los horarios del DPP).
    const horas = dias.flatMap((d, i) =>
      turnos.map((t) => ({ fechaOperativa: dia(d), turnoId: t.id, horas: horasTurnoEn(horariosPorDia[i], t.id, d) })),
    );

    return {
      desde: dia(desde),
      hasta: dia(hasta),
      fr: calcularFr(bloques, rems),
      otif: calcularOtif(bloques, rems),
      averiasVsFabricado: calcularAveriasVsFabricado(rems, reportes),
      ranking: calcularRankingPt(bloques, rems),
      productividad: calcularProductividad(rems, asistencias, horas),
      productos: nombres(productos, (p) => p.descripcion),
      turnos: nombres(turnos, (t) => t.nombre),
      grupos: nombres(grupos, (g) => g.nombre),
    };
  }
}

export class RitmoDiaUseCase {
  constructor(
    private readonly bloques: BloqueRepository,
    private readonly remisiones: RemisionRepository,
    private readonly catalogos: CatalogoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(fechaOperativa: Date): Promise<RitmoDiaResultado> {
    const [bloques, remisiones, turnos] = await Promise.all([
      this.bloques.listarPorFecha(fechaOperativa),
      // Todas las del día, en cualquier estado: el ritmo cuenta lo creado (usuario, 2026-10-06).
      this.remisiones.listarTodas({ fechaOperativaDesde: fechaOperativa, fechaOperativaHasta: fechaOperativa }),
      this.catalogos.listarTurnos(),
    ]);

    const ritmo = calcularRitmo(
      dia(fechaOperativa),
      bloques.map((b) => {
        const d = b.aObjeto();
        const { inicio, fin } = rangoOperativo(d);
        return { turnoId: d.turnoId, inicioMinutos: inicio, finMinutos: fin, targetCajas: calcularBloque(d, undefined).targetCajas };
      }),
      remisiones.map((r) => {
        const d = r.aObjeto();
        return { turnoId: d.turnoId, cajas: d.cantidadCajas, creada: d.fechaHoraRegistro, extraoficial: d.extraoficial };
      }),
      this.reloj.ahora(),
    );

    return { ...ritmo, fechaOperativa: dia(fechaOperativa), turnos: nombres(turnos, (t) => t.nombre) };
  }
}
