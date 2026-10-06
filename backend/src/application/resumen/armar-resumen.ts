/**
 * ARMADOR DEL RESUMEN DEL TURNO / DEL DÍA
 * =======================================
 *
 * Toma la "foto" que se guarda al cerrar el turno. No calcula nada nuevo:
 * reúne lo que ya calculan el tablero del MFR (producción y personal), el
 * indicador de averías y las alertas de inventario, más las remisiones y
 * el consumo por receta del periodo. Así el resumen dice exactamente lo
 * mismo que las pantallas.
 *
 * Lee UNA vez (`leer`) y compone el resumen del turno y, si es el último
 * turno abierto del día, también el del día (`componer`). Solo lee, con
 * los repositorios de lectura, antes de abrir la transacción del cierre.
 */

import type { CausalAveriaRepository } from '../../domain/averia/causal-averia.js';
import { totalizarUnidades } from '../../domain/averia/registro-averia.js';
import type { ReporteAveriaRepository } from '../../domain/averia/reporte-averia.js';
import type { ItemInventarioRepository } from '../../domain/inventario/item-inventario.js';
import type { MovimientoInventarioRepository } from '../../domain/inventario/movimiento-inventario.js';
import { ESTADOS_QUE_CUENTAN, faltantesDelTurno } from '../../domain/mfr/calculo-mfr.js';
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import type { ProductoRepository } from '../../domain/producto/producto.repository.js';
import { ESTADOS_REMISION } from '../../domain/remision/remision.entity.js';
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
import type { DatosResumen, ResumenTurnoRepository, SeccionInventario } from '../../domain/resumen/resumen-turno.js';
import type { IndicadorAveriasUseCase } from '../averia/indicador-averias.use-case.js';
import type { AlertasInventarioUseCase } from '../inventario/alertas-inventario.use-case.js';
import type { IndicadoresDiaUseCase } from '../mfr/indicadores-dia.use-case.js';

export interface FuentesResumen {
  indicadoresDia: Pick<IndicadoresDiaUseCase, 'ejecutar'>;
  indicadorAverias: Pick<IndicadorAveriasUseCase, 'ejecutar'>;
  alertasInventario: Pick<AlertasInventarioUseCase, 'ejecutar'>;
  remisiones: RemisionRepository;
  productos: ProductoRepository;
  reportesAveria: ReporteAveriaRepository;
  causales: CausalAveriaRepository;
  movimientos: MovimientoInventarioRepository;
  items: ItemInventarioRepository;
  horarios: HorarioRepository;
  resumenes: ResumenTurnoRepository;
}

export interface PeticionCierre {
  fechaOperativa: Date;
  turnoId: string;
  motivoFaltante: string | null;
  novedades: string;
}

export interface ResumenesDelCierre {
  turno: DatosResumen;
  /** Solo si, con este cierre, quedan cerrados todos los turnos programados del día. */
  dia: DatosResumen | null;
}

const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;

type Lectura = Awaited<ReturnType<ArmadorDeResumen['leer']>>;

export class ArmadorDeResumen {
  constructor(private readonly f: FuentesResumen) {}

  async prepararCierre(p: PeticionCierre): Promise<ResumenesDelCierre> {
    const lectura = await this.leer(p.fechaOperativa);
    const turno = lectura.tablero.turnos.find((t) => t.turnoId === p.turnoId);
    const etiqueta = turno?.codigo ?? '';
    const datosTurno = this.componer(lectura, p.turnoId, p.motivoFaltante, [{ turno: etiqueta, texto: p.novedades }]);

    // ¿Queda algún OTRO turno con bloques abiertos? Si no, este cierre termina el día.
    const otrosAbiertos = lectura.tablero.bloques.some((b) => b.turnoId !== p.turnoId && !b.cerrado);
    if (otrosAbiertos) return { turno: datosTurno, dia: null };

    // El día junta las novedades y los motivos de faltante que se dieron en cada turno.
    const previos = lectura.resumenes.filter((r) => r.tipo === 'TURNO' && r.turnoId !== p.turnoId);
    const novedades = [...previos.flatMap((r) => r.datos.novedades), { turno: etiqueta, texto: p.novedades }].sort((a, b) => a.turno.localeCompare(b.turno));
    const motivos = [
      ...previos.filter((r) => r.datos.produccion.motivoFaltante).map((r) => `${r.datos.titulo.split(' ')[0]}: ${r.datos.produccion.motivoFaltante}`),
      ...(p.motivoFaltante ? [`${etiqueta}: ${p.motivoFaltante}`] : []),
    ];
    return { turno: datosTurno, dia: this.componer(lectura, null, motivos.length > 0 ? motivos.join(' · ') : null, novedades) };
  }

  private async leer(fechaOperativa: Date) {
    const [tablero, averias, alertas, remisiones, productos, reportes, causales, movimientos, items, horarios, produccion, resumenes] = await Promise.all([
      this.f.indicadoresDia.ejecutar(fechaOperativa),
      this.f.indicadorAverias.ejecutar(fechaOperativa, fechaOperativa),
      this.f.alertasInventario.ejecutar(fechaOperativa),
      this.f.remisiones.listarTodas({ fechaOperativaDesde: fechaOperativa, fechaOperativaHasta: fechaOperativa }),
      this.f.productos.listar({}),
      this.f.reportesAveria.listar({ desde: fechaOperativa, hasta: fechaOperativa, estado: 'REGISTRADO' }),
      this.f.causales.listar(),
      this.f.movimientos.listar({ desde: fechaOperativa, hasta: fechaOperativa, tipo: 'SALIDA' }),
      this.f.items.listar({}),
      this.f.horarios.vigentesEn(fechaOperativa),
      this.f.remisiones.totalizarCajas(fechaOperativa, ESTADOS_QUE_CUENTAN),
      this.f.resumenes.listarPorFecha(fechaOperativa),
    ]);
    return { fechaOperativa, tablero, averias, alertas, remisiones, productos, reportes, causales, movimientos, items, horarios, produccion, resumenes };
  }

  /** `turnoId` null = el día operativo completo. */
  private componer(l: Lectura, turnoId: string | null, motivoFaltante: string | null, novedades: DatosResumen['novedades']): DatosResumen {
    const delPeriodo = <T extends { turnoId: string | null }>(x: T) => !turnoId || x.turnoId === turnoId;
    const producto = new Map(l.productos.map((p) => [p.id, p]));
    const cod = (id: string) => producto.get(id)?.codigo ?? id;
    const turno = turnoId ? l.tablero.turnos.find((t) => t.turnoId === turnoId) : null;

    // ---------- Producción (cajas aprobadas contra el target del DPP) ----------
    const bloques = l.tablero.bloques.filter(delPeriodo);
    const programado = new Map<string, number>();
    const porLinea = new Map<string, number>();
    for (const b of bloques) {
      programado.set(b.productoId, (programado.get(b.productoId) ?? 0) + b.targetCajas);
      porLinea.set(b.lineaId, (porLinea.get(b.lineaId) ?? 0) + b.targetCajas);
    }
    const producido = new Map<string, number>();
    for (const p of l.produccion.filter((x) => !x.extraoficial && delPeriodo(x))) {
      producido.set(p.productoId, (producido.get(p.productoId) ?? 0) + p.cajas);
    }
    const lineaCodigo = new Map(l.tablero.lineas.map((x) => [x.lineaId, x.codigo]));
    const faltantes = turnoId
      ? faltantesDelTurno(turnoId, l.tablero.bloques, l.produccion)
      : [...programado]
          .filter(([id, prog]) => (producido.get(id) ?? 0) < Math.round(prog))
          .map(([productoId, programadoCajas]) => ({ productoId, programadoCajas, producidoCajas: producido.get(productoId) ?? 0 }));
    const programadoCajas = Math.round(suma(programado.values()));
    const producidoCajas = suma(producido.values());

    // ---------- Remisiones del periodo ----------
    const remisiones = l.remisiones.map((r) => ({ r, d: r.aObjeto() })).filter((x) => !turnoId || x.d.turnoId === turnoId);
    const porEstado = Object.fromEntries(ESTADOS_REMISION.map((e) => [e, 0])) as Record<string, number>;
    for (const { d } of remisiones) porEstado[d.estado] += 1;

    // ---------- Averías por causal ----------
    const causalNombre = new Map(l.causales.map((c) => [c.id, c.nombre]));
    const porCausal = new Map<string, number>();
    for (const registro of l.reportes.filter(delPeriodo).flatMap((x) => x.registros)) {
      const nombre = causalNombre.get(registro.causalId) ?? registro.causalId;
      porCausal.set(nombre, (porCausal.get(nombre) ?? 0) + totalizarUnidades([registro]).unidades);
    }
    const medidaAverias = turnoId ? l.averias.porTurno.find((t) => t.turnoId === turnoId) : l.averias.total;

    // ---------- Inventario: lo que descontaron las recetas ----------
    const item = new Map(l.items.map((i) => [i.id, i]));
    const consumo = new Map<string, number>();
    for (const m of l.movimientos.filter((x) => x.remisionId && delPeriodo(x))) {
      consumo.set(m.itemId, Math.round(((consumo.get(m.itemId) ?? 0) + Math.abs(m.cantidad)) * 1000) / 1000);
    }
    const inventario: SeccionInventario = {
      consumo: [...consumo]
        .map(([id, cantidad]) => ({ codigo: item.get(id)?.codigo ?? id, descripcion: item.get(id)?.descripcion ?? '', cantidad, unidad: item.get(id)?.unidadMedida ?? '' }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
      alertas: l.alertas.alertas.filter((a) => a.gravedad === 'CRITICA').map((a) => ({ tipo: a.tipo, codigo: a.codigo, mensaje: a.mensaje })),
    };

    // ---------- Encabezado ----------
    const diaSemana = DIAS[l.fechaOperativa.getUTCDay()];
    const horario = turnoId ? l.horarios.find((h) => h.turnoId === turnoId && h.diaSemana === diaSemana) : null;
    const personal = turno ? turno.personal : l.tablero.personal;

    return {
      titulo: turno ? `${turno.codigo} · ${turno.nombre}` : 'Día operativo completo',
      horario: horario ? `${horario.horaInicio} a ${horario.horaFin}` : turnoId ? null : '06:00 a 06:00 del día siguiente',
      produccion: {
        programadoCajas,
        producidoCajas,
        cumplimiento: porcentaje(producidoCajas, programadoCajas),
        semaforo: turno ? turno.semaforo : l.tablero.mfr.semaforo,
        porProducto: [...new Set([...programado.keys(), ...producido.keys()])]
          .map((id) => ({
            codigo: cod(id),
            descripcion: producto.get(id)?.descripcion ?? '',
            programadoCajas: Math.round(programado.get(id) ?? 0),
            producidoCajas: producido.get(id) ?? 0,
            cumplimiento: porcentaje(producido.get(id) ?? 0, programado.get(id) ?? 0),
          }))
          .sort((a, b) => a.codigo.localeCompare(b.codigo)),
        porLinea: [...porLinea].map(([id, cajas]) => ({ codigo: lineaCodigo.get(id) ?? id, programadoCajas: Math.round(cajas) })).sort((a, b) => a.codigo.localeCompare(b.codigo)),
        faltantes: faltantes.map((x) => ({ codigo: cod(x.productoId), programadoCajas: Math.round(x.programadoCajas), producidoCajas: x.producidoCajas })),
        motivoFaltante,
        extraoficialesCajas: suma(l.produccion.filter((x) => x.extraoficial && delPeriodo(x)).map((x) => x.cajas)),
      },
      remisiones: {
        porEstado,
        lista: remisiones
          .map(({ r, d }) => ({
            consecutivo: r.consecutivo,
            codigo: d.codigoSnapshot,
            descripcion: d.descripcionSnapshot,
            cajas: d.cantidadCajas,
            estado: d.estado,
            motivoRechazo: d.motivoUltimoRechazo ?? null,
            extraoficial: d.extraoficial,
          }))
          .sort((a, b) => a.consecutivo.localeCompare(b.consecutivo)),
      },
      personal: {
        requeridasDpp: personal.requeridasDpp,
        llegaron: personal.llegaron,
        coberturaDpp: personal.coberturaDpp,
        estado: personal.estado,
        grupos: turno ? turno.personal.grupos.map((g) => ({ nombre: g.nombre, esperadas: g.esperadas, llegaron: g.llegaron, estado: g.estado })) : [],
      },
      averias: {
        unidades: medidaAverias?.averiadasUnidades ?? 0,
        porcentaje: medidaAverias?.porcentaje ?? null,
        maximoPorcentaje: l.averias.maximoPorcentaje,
        excede: medidaAverias?.excede ?? false,
        porCausal: [...porCausal].map(([causal, unidades]) => ({ causal, unidades })).sort((a, b) => b.unidades - a.unidades),
      },
      inventario,
      novedades,
    };
  }
}

function suma(valores: Iterable<number>): number {
  let total = 0;
  for (const v of valores) total += v;
  return total;
}

/** % con un decimal; null si no había nada programado. */
function porcentaje(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}
