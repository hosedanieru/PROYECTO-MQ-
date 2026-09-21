/**
 * CASO DE USO: ANALIZAR UN DPP DE PEPSICO
 * =======================================
 *
 * Recibe el TEXTO del PDF (ya extraído por infraestructura) y devuelve
 * una PROPUESTA de bloques cruzada con los catálogos de Inlotrans: qué
 * línea y qué producto corresponde a cada fila y qué falta. No escribe
 * nada: el coordinador revisa la propuesta en pantalla y luego la carga
 * con `CargarDiaUseCase` (origen DPP).
 *
 * Cruces:
 *   línea     por `claveLinea` (código o nombre sin espacios ni guiones)
 *   producto  por los 5 últimos dígitos del código PepsiCo vs el SKU
 *   ritmo     cajas/h = Mx ÷ horas (lo trae `leerDpp`); reproduce el Mx
 *             y el T del PDF exactamente, sin depender del catálogo
 */

import { coincideConSku, leerDpp, type BloqueDpp } from '../../domain/mfr/dpp-pepsico.js';
import { pesoNetoSugeridoKg, type EstandarRepository } from '../../domain/mfr/estandar-produccion.js';
import { claveLinea, type LineaRepository } from '../../domain/mfr/linea-produccion.js';
import { DppNoReconocidoError } from '../../domain/mfr/mfr.errors.js';

export interface BloquePropuesto extends BloqueDpp {
  lineaId: string | null;
  productoId: string | null;
  productoCodigo: string | null;
  /** Cajas/h que el producto tiene como estándar en el catálogo (referencia; manda la del PDF). */
  cajasPorHoraCatalogo: number | null;
  pesoNetoKg: number | null;
  pesoSugeridoKg: number | null;
  advertencias: string[];
}

export interface PropuestaDpp {
  fechaOperativa: string | null;
  bloques: BloquePropuesto[];
  /** Cuántos bloques están listos para cargar (línea y producto resueltos). */
  listos: number;
  advertencias: string[];
}

export class AnalizarDppUseCase {
  constructor(
    private readonly lineas: LineaRepository,
    private readonly estandares: EstandarRepository,
  ) {}

  async ejecutar(texto: string): Promise<PropuestaDpp> {
    const dpp = leerDpp(texto);
    if (dpp.bloques.length === 0) {
      throw new DppNoReconocidoError('El archivo no contiene un schedule de PepsiCo reconocible (sin "Bar Details").');
    }

    const [lineas, estandares] = await Promise.all([this.lineas.listar(), this.estandares.listar()]);
    const lineaPorClave = new Map<string, (typeof lineas)[number]>();
    for (const l of lineas.filter((x) => x.activo)) {
      lineaPorClave.set(claveLinea(l.codigo), l);
      lineaPorClave.set(claveLinea(l.nombre), l);
    }

    const globales = new Set<string>();
    const bloques: BloquePropuesto[] = dpp.bloques.map((b) => {
      const advertencias: string[] = [];
      const linea = lineaPorClave.get(claveLinea(b.linea)) ?? null;
      if (!linea) {
        advertencias.push(`Línea "${b.linea}" no existe en el catálogo.`);
        globales.add(`Crear la línea "${b.linea}" (${b.tipoLinea}) en Administración → Líneas.`);
      }

      const candidatos = estandares.filter((e) => coincideConSku(b.sufijoItem, e.codigo));
      const estandar = candidatos.length === 1 ? candidatos[0] : null;
      if (candidatos.length === 0) {
        advertencias.push(`Ningún producto termina en ${b.sufijoItem} (${b.descripcion}).`);
        globales.add(`Crear el producto …${b.sufijoItem} "${b.descripcion}" en Administración → Productos.`);
      } else if (candidatos.length > 1) {
        advertencias.push(`Varios productos terminan en ${b.sufijoItem}: ${candidatos.map((c) => c.codigo).join(', ')}.`);
      }

      if (estandar) {
        if (estandar.cajasPorHora !== null && Math.abs(estandar.cajasPorHora - b.cajasPorHora) > 0.5) {
          advertencias.push(
            `El PDF trae ${b.cajasPorHora} cajas/h y el estándar del producto ${estandar.codigo} es ${estandar.cajasPorHora}: se usa el del PDF.`,
          );
        }
        if (estandar.pesoNetoKg === null) {
          globales.add(`Registrar el peso neto por caja del producto ${estandar.codigo} para ver kilogramos.`);
        }
      }

      return {
        ...b,
        lineaId: linea?.id ?? null,
        productoId: estandar?.productoId ?? null,
        productoCodigo: estandar?.codigo ?? null,
        cajasPorHoraCatalogo: estandar?.cajasPorHora ?? null,
        pesoNetoKg: estandar?.pesoNetoKg ?? null,
        pesoSugeridoKg: pesoNetoSugeridoKg(b.descripcion),
        advertencias,
      };
    });

    return {
      fechaOperativa: dpp.fechaOperativa,
      bloques,
      listos: bloques.filter((b) => b.lineaId && b.productoId).length,
      advertencias: [...globales],
    };
  }
}
