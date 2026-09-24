/**
 * AVISOS DEL DÍA
 * ==============
 *
 * Esto NO es el módulo de "Alertas por desviación" del roadmap. Aquí no
 * se inventa ninguna regla nueva: se toman las advertencias que ya
 * calcula el backend y los conteos que ya se consultaron, y se ponen a
 * la vista para no tener que entrar a cada pantalla a buscarlos.
 *
 * Cuando exista el módulo de alertas de verdad (con sus umbrales
 * definidos por el área y su historial), este archivo se reemplaza por
 * una consulta.
 *
 * Función pura: recibe datos, devuelve avisos. Se puede probar sin
 * navegador.
 */

import type { TonoBadge } from '../../../components/Badge'
import type { IndicadoresDia } from '../../../shared/types/mfr'
import type { EstadoRemision } from '../../../shared/types/remision'
import { porcentaje } from '../../../shared/utils/numeros'

export interface Aviso {
  clave: string
  tono: TonoBadge
  titulo: string
  texto: string
  /** Pantalla donde se resuelve. */
  a?: string
}

interface Entrada {
  indicadores: IndicadoresDia | undefined
  porEstado: Record<EstadoRemision, number> | undefined
  fecha: string
}

export function construirAvisos({ indicadores, porEstado, fecha }: Entrada): Aviso[] {
  const avisos: Aviso[] = []
  const listado = (estado: EstadoRemision) => `/remisiones?desde=${fecha}&hasta=${fecha}&estado=${estado}`

  if (porEstado) {
    if (porEstado.RECHAZADA > 0) {
      avisos.push({
        clave: 'rechazadas',
        tono: 'critico',
        titulo: `${porEstado.RECHAZADA} remisión(es) rechazada(s)`,
        texto: 'PepsiCo no las aceptó. Hay que rectificarlas para que no se pierda el consecutivo.',
        a: listado('RECHAZADA'),
      })
    }

    if (porEstado.APROBADA > 0) {
      avisos.push({
        clave: 'sin-conciliar',
        tono: 'alerta',
        titulo: `${porEstado.APROBADA} aprobada(s) sin conciliar`,
        texto: 'Aprobar no es validar: quedan pendientes de conciliación interna.',
        a: listado('APROBADA'),
      })
    }

    if (porEstado.BORRADOR > 0) {
      avisos.push({
        clave: 'borradores',
        tono: 'marca',
        titulo: `${porEstado.BORRADOR} en borrador`,
        texto: 'Registradas pero todavía sin entregar al OPA.',
        a: listado('BORRADOR'),
      })
    }
  }

  if (indicadores) {
    if (indicadores.mfr.programadoCajas === 0) {
      avisos.push({
        clave: 'sin-dpp',
        tono: 'critico',
        titulo: 'El día no tiene DPP cargado',
        texto: 'Sin programación no se puede remisionar: el tope por SKU no se puede verificar.',
        a: `/mfr/programacion?fecha=${fecha}`,
      })
    } else if (indicadores.mfr.cumplimiento !== null && indicadores.mfr.cumplimiento < indicadores.meta) {
      avisos.push({
        clave: 'mfr-bajo',
        tono: 'alerta',
        titulo: `MFR en ${porcentaje(indicadores.mfr.cumplimiento)}`,
        texto: `Por debajo de la meta del ${indicadores.meta} %.`,
        a: `/mfr?fecha=${fecha}`,
      })
    }

    // Las calcula el backend (SKU sin peso, bloques solapados, etc.).
    for (const [indice, advertencia] of indicadores.advertencias.entries()) {
      avisos.push({
        clave: `backend-${indice}`,
        tono: 'alerta',
        titulo: 'Revisar programación',
        texto: advertencia,
        a: `/mfr/programacion?fecha=${fecha}`,
      })
    }
  }

  return avisos
}
