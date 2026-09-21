/**
 * LECTURA DEL DPP DE PEPSICO ("SCHEDULE WM OMEGA", GDPP508P)
 * ==========================================================
 *
 * Interpreta el TEXTO ya extraído del PDF (extraerlo es trabajo de
 * infraestructura; aquí no se importa nada). Cada página del DPP es una
 * plataforma (LINEA 1…4, MANUAL 1, MANUAL 2, REEMPAQUES) y termina con
 * una tabla "Bar Details" con una fila por bloque:
 *
 *   L1  MULTIPACK  09/16/2026 06:00 AM  271350PQJ02-66770SURT MG LNC 586GX4X1 BX22
 *       Trgt: 979 Loop: LOOP1 Max: 1,125 Efncy: 0.87  09/16/2026 01:30 PM
 *
 * De esa fila salen línea, tipo, inicio, fin, código PepsiCo, descripción,
 * target, máximo, eficiencia y loop. El BPM no está en "Bar Details";
 * se toma de la franja horaria de la misma página, donde el bloque
 * aparece como "... T: 979 Lp: LOOP1 BPM: 10.00 Mx: 1,125 E: 0.87".
 *
 * Cruce con el catálogo de Inlotrans: los 5 dígitos finales del código
 * PepsiCo ("…-66770") son los 5 últimos del SKU ("300066770").
 */

import { horasDeHorario } from './horas-turno.js';

export interface BloqueDpp {
  /** Nombre de la línea tal como viene ("MANUAL 1", "REEMPAQU 2"). */
  linea: string;
  tipoLinea: 'MULTIPACK' | 'MANUAL';
  fechaInicio: string; // YYYY-MM-DD
  horaInicio: string; // HH:mm
  horaFin: string;
  codigoPepsico: string; // "271350PQJ02-66770"
  /** Últimos 5 dígitos del código: la clave para cruzar con el SKU. */
  sufijoItem: string;
  descripcion: string;
  targetCajas: number;
  maxCajas: number;
  eficienciaPorcentaje: number;
  loop: string | null;
  /** BPM (bolsas/minuto) tal como lo trae el PDF; null si la franja no lo trae legible. Solo informativo. */
  bpm: number | null;
  /**
   * Ritmo en cajas por hora: Mx ÷ horas del bloque, con dos decimales.
   * Es lo que se guarda (decisión del área, 2026-09-19); reproduce el Mx
   * del PDF al multiplicar por las horas.
   */
  cajasPorHora: number;
}

export interface DppLeido {
  /** "Date:" del encabezado, en YYYY-MM-DD; null si no se encontró. */
  fechaOperativa: string | null;
  bloques: BloqueDpp[];
}

const FILA_BAR_DETAILS =
  /^(.+?)\s+(MULTIPACK|MANUAL)\s+(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2} [AP]M)\s+(\d{6}[A-Z0-9]{5}-(\d{5}))(.*?)\s+Trgt:\s*([\d,]+)(?:\s+Loop:\s*(.+?))?\s+Max:\s*([\d,]+)\s+Efncy:\s*([\d.]+)\s+(\d{2}\/\d{2}\/\d{4}) (\d{2}:\d{2} [AP]M)\s*$/;

/** "Mx" puede faltar cuando la franja se corta por espacio ("BPM: 16.00" al final). */
const SEGMENTO_FRANJA = /^(\d{6}[A-Z0-9]{5}-\d{5}).*?BPM:\s*([\d.]+)(?:\s+Mx:\s*([\d,]+))?/;

export function leerDpp(texto: string): DppLeido {
  const lineas = texto.split(/\r?\n/);
  const bloques: BloqueDpp[] = [];
  const bpmPorCodigoYMax = new Map<string, number>();
  const bpmPorCodigo = new Map<string, number>();
  let fechaOperativa: string | null = null;

  for (const linea of lineas) {
    // Encabezado: "Date: \t09/16/2026 \tShift: 1 - 3 ..."
    const fecha = /Date:\s*(\d{2}\/\d{2}\/\d{4})/.exec(linea);
    if (fecha && !fechaOperativa) fechaOperativa = fechaIso(fecha[1]);

    // Franja horaria: segmentos separados por tabulador, uno por bloque visible.
    for (const segmento of linea.split('\t')) {
      const m = SEGMENTO_FRANJA.exec(segmento.trim());
      if (m) {
        const bpm = Number(m[2]);
        if (m[3]) bpmPorCodigoYMax.set(`${m[1]}|${numero(m[3])}`, bpm);
        if (!bpmPorCodigo.has(m[1])) bpmPorCodigo.set(m[1], bpm);
      }
    }

    // Bar Details: una fila por bloque.
    const fila = FILA_BAR_DETAILS.exec(linea.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim());
    if (!fila) continue;
    const [, nombreLinea, tipoLinea, fechaIni, horaIni, codigo, sufijo, descripcion, trgt, loop, max, efncy, , horaFinTexto] = fila;
    const horaInicio = hora24(horaIni);
    const horaFin = hora24(horaFinTexto);
    const maxCajas = numero(max);
    bloques.push({
      linea: nombreLinea.trim(),
      tipoLinea: tipoLinea as 'MULTIPACK' | 'MANUAL',
      fechaInicio: fechaIso(fechaIni),
      horaInicio,
      horaFin,
      codigoPepsico: codigo,
      sufijoItem: sufijo,
      descripcion: descripcion.trim(),
      targetCajas: numero(trgt),
      maxCajas,
      eficienciaPorcentaje: Math.round(Number(efncy) * 100),
      loop: loop?.trim() || null,
      bpm: null,
      cajasPorHora: Math.round((maxCajas / horasDeHorario({ horaInicio, horaFin })) * 100) / 100,
    });
  }

  for (const b of bloques) {
    b.bpm = bpmPorCodigoYMax.get(`${b.codigoPepsico}|${b.maxCajas}`) ?? bpmPorCodigo.get(b.codigoPepsico) ?? null;
  }

  return { fechaOperativa, bloques };
}

/** ¿El código PepsiCo ("…-66770") corresponde al SKU ("300066770")? */
export function coincideConSku(sufijoItem: string, codigoSku: string): boolean {
  const digitos = codigoSku.replace(/\D/g, '');
  return digitos.length >= 5 && digitos.endsWith(sufijoItem);
}

/** "1,125" → 1125 */
function numero(texto: string): number {
  return Number(texto.replace(/,/g, ''));
}

/** "09/16/2026" (MM/DD/YYYY) → "2026-09-16" */
function fechaIso(texto: string): string {
  const [mes, dia, anio] = texto.split('/');
  return `${anio}-${mes}-${dia}`;
}

/** "01:30 PM" → "13:30"; "12:00 AM" → "00:00"; "12:15 PM" → "12:15" */
function hora24(texto: string): string {
  const [hm, sufijo] = texto.split(' ');
  const [h, m] = hm.split(':').map(Number);
  const hora = sufijo === 'PM' ? (h % 12) + 12 : h % 12;
  return `${String(hora).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
