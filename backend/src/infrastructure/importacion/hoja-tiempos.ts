/**
 * LECTURA DE LA HOJA "TIEMPOS" DEL EXCEL DE REMISIONES
 * =====================================================
 *
 * Convierte las filas de la hoja en registros validados y una lista de
 * EXCEPCIONES para revisión del coordinador. Nada se adivina: una fila
 * con datos contradictorios se reporta y se omite (regla 6 del proyecto).
 *
 * Columnas de la hoja (2026-09-19):
 *   ITEM · DESCRIPCION · PROCESO · UNIDADES X CAJA · CAJAS X ESTIBA ·
 *   HORAS TURNO (se ignora) · PRODUCTIVIDAD ESTIBA HORA ·
 *   UNIDADES POR HORA (fórmula, se ignora) · CAJAS POR HORA (fórmula =
 *   productividad × cajas por estiba) · LINEA IDEAL · SUBDESCRIPCION ·
 *   PC (se ignora, área 2026-09-19) · FICHA DE ARMADO
 *
 * Esta parte no sabe de Excel: recibe las filas como arreglos de celdas
 * ya leídas (texto o número) para poder probarse sin archivos.
 */

import { pesoNetoSugeridoKg } from '../../domain/mfr/estandar-produccion.js';
import type { ProcesoProducto } from '../../domain/producto/producto.repository.js';

/** Una celda ya leída: número, texto, o nada. */
export type Celda = string | number | null;

export interface FilaTiempos {
  numeroFila: number;
  celdas: Celda[];
}

export interface RegistroTiempos {
  numeroFila: number;
  codigo: string;
  descripcion: string;
  proceso: ProcesoProducto | null;
  unidadesPorCaja: number | null;
  cajasPorEstiba: number | null;
  cajasPorHora: number | null;
  personasIdeal: number | null;
  subdescripcion: string | null;
  /** Deducido de la descripción; null si no se pudo o si contradice las unidades por caja. */
  pesoSugeridoKg: number | null;
}

export interface ExcepcionTiempos {
  numeroFila: number;
  codigo: string | null;
  motivo: string;
}

export interface LecturaTiempos {
  registros: RegistroTiempos[];
  excepciones: ExcepcionTiempos[];
}

const COLUMNAS = {
  codigo: 0,
  descripcion: 1,
  proceso: 2,
  unidadesPorCaja: 3,
  cajasPorEstiba: 4,
  productividadEstibaHora: 6,
  cajasPorHora: 8,
  lineaIdeal: 9,
  subdescripcion: 10,
} as const;

/** "AUTOMATICO" es un error de digitación de la hoja; "LINEA" aparece en PRODUCTOS y no está confirmado. */
const PROCESOS: Record<string, ProcesoProducto> = { MANUAL: 'MANUAL', AUTOMATICA: 'AUTOMATICA', AUTOMATICO: 'AUTOMATICA' };

function texto(celda: Celda): string {
  return celda === null ? '' : String(celda).trim();
}

function numero(celda: Celda): number | null {
  if (celda === null || celda === '') return null;
  const n = typeof celda === 'number' ? celda : Number(String(celda).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function enteroPositivo(celda: Celda): number | null {
  const n = numero(celda);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

/** Unidades por caja según la descripción ("586GX3X1" → 3), para contrastar con la columna. */
function unidadesEnDescripcion(descripcion: string): number | null {
  const m = /(\d+)X1\b/.exec(descripcion.toUpperCase());
  return m ? Number(m[1]) : null;
}

export function leerHojaTiempos(filas: FilaTiempos[]): LecturaTiempos {
  const excepciones: ExcepcionTiempos[] = [];
  const porCodigo = new Map<string, RegistroTiempos[]>();

  for (const { numeroFila, celdas } of filas) {
    const c = (i: number): Celda => celdas[i] ?? null;
    const codigo = texto(c(COLUMNAS.codigo));
    const descripcion = texto(c(COLUMNAS.descripcion));
    if (!codigo && !descripcion) continue; // fila de plantilla vacía
    if (!codigo) {
      excepciones.push({ numeroFila, codigo: null, motivo: `Fila sin código de ítem (descripción "${descripcion}").` });
      continue;
    }
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(codigo)) {
      excepciones.push({ numeroFila, codigo, motivo: 'El código tiene caracteres no válidos.' });
      continue;
    }
    if (!descripcion) {
      excepciones.push({ numeroFila, codigo, motivo: 'Fila sin descripción.' });
      continue;
    }

    const procesoTexto = texto(c(COLUMNAS.proceso)).toUpperCase();
    const proceso = procesoTexto ? (PROCESOS[procesoTexto] ?? null) : null;
    if (procesoTexto && !proceso) {
      excepciones.push({ numeroFila, codigo, motivo: `Proceso "${procesoTexto}" no reconocido (se esperaba MANUAL o AUTOMATICA); se deja sin proceso.` });
    }

    const unidadesPorCaja = enteroPositivo(c(COLUMNAS.unidadesPorCaja));
    if (texto(c(COLUMNAS.unidadesPorCaja)) && unidadesPorCaja === null) {
      excepciones.push({ numeroFila, codigo, motivo: `"UNIDADES X CAJA" no es un entero positivo (${texto(c(COLUMNAS.unidadesPorCaja))}).` });
    }
    const cajasPorEstiba = enteroPositivo(c(COLUMNAS.cajasPorEstiba));
    if (texto(c(COLUMNAS.cajasPorEstiba)) && cajasPorEstiba === null) {
      excepciones.push({ numeroFila, codigo, motivo: `"CAJAS X ESTIBA" no es un entero positivo (${texto(c(COLUMNAS.cajasPorEstiba))}).` });
    }

    // Cajas por hora: la celda (fórmula) o, si no tiene resultado, productividad × cajas por estiba.
    let cajasPorHora = numero(c(COLUMNAS.cajasPorHora));
    if (cajasPorHora === null) {
      const productividad = numero(c(COLUMNAS.productividadEstibaHora));
      if (productividad !== null && cajasPorEstiba !== null) cajasPorHora = productividad * cajasPorEstiba;
    }
    if (cajasPorHora !== null && cajasPorHora <= 0) {
      excepciones.push({ numeroFila, codigo, motivo: `"CAJAS POR HORA" no es mayor que cero (${cajasPorHora}).` });
      cajasPorHora = null;
    }
    if (cajasPorHora === null) {
      excepciones.push({ numeroFila, codigo, motivo: 'Sin "CAJAS POR HORA" (ni productividad por estiba para calcularlas): el estándar queda vacío.' });
    }

    // Cero personas no es una línea posible: se toma como "sin dato" y se reporta.
    const lineaIdeal = numero(c(COLUMNAS.lineaIdeal));
    const personasIdeal = lineaIdeal !== null && Number.isInteger(lineaIdeal) && lineaIdeal > 0 ? lineaIdeal : null;
    if (lineaIdeal !== null && personasIdeal === null) {
      excepciones.push({ numeroFila, codigo, motivo: `"LINEA IDEAL" en ${lineaIdeal}: no es un número de personas válido; se deja sin dato.` });
    }

    const subdescripcion = texto(c(COLUMNAS.subdescripcion)).toUpperCase() || null;

    let pesoSugeridoKg = pesoNetoSugeridoKg(descripcion);
    const unidadesTexto = unidadesEnDescripcion(descripcion);
    if (pesoSugeridoKg !== null && unidadesTexto !== null && unidadesPorCaja !== null && unidadesTexto !== unidadesPorCaja) {
      excepciones.push({
        numeroFila,
        codigo,
        motivo: `La descripción dice ${unidadesTexto} unidades por caja ("…${unidadesTexto}X1") y la columna dice ${unidadesPorCaja}: no se propone peso.`,
      });
      pesoSugeridoKg = null;
    }

    const registro: RegistroTiempos = {
      numeroFila, codigo, descripcion, proceso, unidadesPorCaja, cajasPorEstiba, cajasPorHora, personasIdeal, subdescripcion, pesoSugeridoKg,
    };
    porCodigo.set(codigo, [...(porCodigo.get(codigo) ?? []), registro]);
  }

  // Duplicados: iguales → se toma uno; distintos → se omiten todos y se reporta.
  const registros: RegistroTiempos[] = [];
  for (const [codigo, lista] of porCodigo) {
    if (lista.length === 1) {
      registros.push(lista[0]);
      continue;
    }
    const clave = (r: RegistroTiempos) =>
      JSON.stringify([r.descripcion, r.proceso, r.unidadesPorCaja, r.cajasPorEstiba, r.cajasPorHora, r.personasIdeal, r.subdescripcion]);
    const distintos = new Set(lista.map(clave));
    if (distintos.size === 1) {
      registros.push(lista[0]);
      excepciones.push({ numeroFila: lista[1].numeroFila, codigo, motivo: `Código repetido ${lista.length} veces con los mismos datos (filas ${lista.map((r) => r.numeroFila).join(', ')}); se toma una.` });
    } else {
      excepciones.push({
        numeroFila: lista[0].numeroFila,
        codigo,
        motivo: `Código repetido con datos DISTINTOS (filas ${lista.map((r) => r.numeroFila).join(', ')}); se omite: el área debe decidir cuál vale.`,
      });
    }
  }

  registros.sort((a, b) => a.numeroFila - b.numeroFila);
  return { registros, excepciones };
}
