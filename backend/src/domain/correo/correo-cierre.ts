/**
 * CORREOS DEL CIERRE DEL TURNO — reglas puras
 * ===========================================
 *
 * Decisiones del usuario (2026-10-03 y 2026-10-10): al cerrar el turno
 * salen DOS correos, cada uno a las listas que dicen recibirlo:
 *
 *   RESUMEN      el PDF del turno (RT-…) y, si ese cierre terminó el día,
 *                el del día (RD-…)            → listas RESUMEN o AMBOS
 *   REMISIONES   el PDF de las aprobadas del turno; las pendientes y
 *                rechazadas van enumeradas en el cuerpo. Si no hubo
 *                aprobadas, sale igual, sin adjunto  → listas REMISIONES o AMBOS
 *
 * En los dos van las listas generales marcadas "incluir en cierres" y la
 * lista del turno SIGUIENTE (al cerrar el T1 recibe la del T2; al cerrar el
 * T3, la del T1).
 */

import type { ListaDistribucion } from './correo.js';

export type ContenidoCierre = 'RESUMEN' | 'REMISIONES';

export interface TurnoOrdenable {
  id: string;
  codigo: string;
  activo: boolean;
}

/** El turno que sigue al cerrado, en el orden de su código (T1 → T2 → T3 → T1). */
export function turnoSiguiente(turnos: TurnoOrdenable[], turnoId: string): string | null {
  const activos = turnos.filter((t) => t.activo).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const i = activos.findIndex((t) => t.id === turnoId);
  if (i < 0 || activos.length < 2) return null;
  return activos[(i + 1) % activos.length].id;
}

/** Listas que reciben ese contenido al cerrar el turno. */
export function listasDelCierre(listas: ListaDistribucion[], contenido: ContenidoCierre, siguienteId: string | null): ListaDistribucion[] {
  return listas.filter(
    (l) =>
      l.activo &&
      (l.recibe === contenido || l.recibe === 'AMBOS') &&
      (l.turnoId === null ? l.incluirEnCierres : l.turnoId === siguienteId),
  );
}

/** "10/10/2026": la fecha operativa es de solo día y se lee en UTC. */
export function fechaCorreo(fechaOperativa: Date): string {
  const [anio, mes, dia] = fechaOperativa.toISOString().slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const PIE = ['', 'Correo generado por el aplicativo MQ al cerrar el turno.'];
const ENCABEZADO = 'Maquila PepsiCo Santo Domingo — Inlotrans S.A.S.';

export interface DatosCorreoResumen {
  turno: string;
  fechaOperativa: Date;
  consecutivoTurno: string;
  /** Solo si el cierre terminó el día operativo. */
  consecutivoDia: string | null;
}

export function correoDeResumen(d: DatosCorreoResumen): { asunto: string; texto: string } {
  const fecha = fechaCorreo(d.fechaOperativa);
  const asunto = `Resumen MQ ${d.turno} · ${fecha} (${d.consecutivoTurno}${d.consecutivoDia ? ` y ${d.consecutivoDia}` : ''})`;
  const texto = [
    ENCABEZADO,
    '',
    `Se cerró el turno ${d.turno} del día operativo ${fecha}.`,
    `Se adjunta el resumen del turno (${d.consecutivoTurno}).`,
    ...(d.consecutivoDia ? [`Con este cierre terminó el día: se adjunta también el resumen del día (${d.consecutivoDia}).`] : []),
    ...PIE,
  ].join('\n');
  return { asunto, texto };
}

export interface DatosCorreoRemisiones {
  turno: string;
  fechaOperativa: Date;
  /** Una línea por remisión aprobada (van en el PDF). */
  aprobadas: string[];
  /** Una línea por remisión sin aprobar o rechazada (solo en el cuerpo). */
  pendientes: string[];
}

export function correoDeRemisiones(d: DatosCorreoRemisiones): { asunto: string; texto: string } {
  const fecha = fechaCorreo(d.fechaOperativa);
  const n = d.aprobadas.length;
  const asunto = `Remisiones MQ ${d.turno} · ${fecha}: ${n === 0 ? 'sin remisiones aprobadas' : n === 1 ? '1 aprobada' : `${n} aprobadas`}`;
  const texto = [
    ENCABEZADO,
    '',
    `Se cerró el turno ${d.turno} del día operativo ${fecha}.`,
    '',
    ...(n === 0
      ? ['No hubo remisiones aprobadas en este turno; este correo no lleva adjunto.']
      : [`Remisiones aprobadas (${n}, adjuntas en PDF):`, ...d.aprobadas.map((l) => `  - ${l}`)]),
    ...(d.pendientes.length > 0
      ? ['', `Pendientes de aprobación o rechazadas (${d.pendientes.length}, no se adjuntan):`, ...d.pendientes.map((l) => `  - ${l}`)]
      : []),
    ...PIE,
  ].join('\n');
  return { asunto, texto };
}
