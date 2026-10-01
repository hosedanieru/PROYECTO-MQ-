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
import type { IndicadorAverias } from '../../../shared/types/averia'
import type { AlertaInventario, AlertasInventarioDia, TipoAlertaInventario } from '../../../shared/types/inventario'
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
  /** % de averías del día; `undefined` sin permiso o mientras carga. */
  averias?: IndicadorAverias
  /** Alertas de inventario del día (las calcula el backend); `undefined` sin permiso. */
  inventario?: AlertasInventarioDia
  fecha: string
}

/** "CINTA-48, BOLSA-25G, CAJA-12X y 4 más". */
function algunosCodigos(alertas: AlertaInventario[]): string {
  const codigos = alertas.slice(0, 3).map((a) => a.codigo).join(', ')
  return alertas.length > 3 ? `${codigos} y ${alertas.length - 3} más` : codigos
}

/** Un aviso por tipo de alerta de inventario (no uno por ítem: pueden ser decenas). */
function avisosDeInventario(inventario: AlertasInventarioDia, fecha: string): Aviso[] {
  const a = `/inventario/alertas?fecha=${fecha}`
  const de = (tipo: TipoAlertaInventario, gravedad?: 'CRITICA' | 'ADVERTENCIA') =>
    inventario.alertas.filter((x) => x.tipo === tipo && (!gravedad || x.gravedad === gravedad))
  const avisos: Aviso[] = []

  const noAlcanza = de('NO_ALCANZA_DPP')
  if (noAlcanza.length > 0) {
    avisos.push({ clave: 'inv-no-alcanza', tono: 'critico', a, titulo: `${noAlcanza.length} material(es) no alcanzan para el DPP`, texto: `${algunosCodigos(noAlcanza)}. Sin existencia suficiente, la aprobación de remisiones se bloquea.` })
  }
  const sinRecetaDpp = de('PT_SIN_RECETA', 'CRITICA')
  if (sinRecetaDpp.length > 0) {
    avisos.push({ clave: 'inv-sin-receta-dpp', tono: 'critico', a, titulo: `${sinRecetaDpp.length} PT del DPP sin receta`, texto: `${algunosCodigos(sinRecetaDpp)}. Sus remisiones no se podrán aprobar.` })
  }
  const agotados = de('AGOTADO', 'CRITICA')
  if (agotados.length > 0) {
    avisos.push({ clave: 'inv-agotados', tono: 'alerta', a, titulo: `${agotados.length} material(es) agotado(s) que usan recetas`, texto: algunosCodigos(agotados) })
  }
  const inactivos = de('COMPONENTE_INACTIVO')
  if (inactivos.length > 0) {
    avisos.push({ clave: 'inv-inactivos', tono: 'alerta', a, titulo: `${inactivos.length} receta(s) con componente inactivo`, texto: algunosCodigos(inactivos) })
  }
  const sinReceta = de('PT_SIN_RECETA', 'ADVERTENCIA')
  if (sinReceta.length > 0) {
    avisos.push({ clave: 'inv-sin-receta', tono: 'marca', a, titulo: `${sinReceta.length} PT sin receta`, texto: 'Hay que digitarla antes de aprobar remisiones de esos PT.' })
  }
  return avisos
}

export function construirAvisos({ indicadores, porEstado, averias, inventario, fecha }: Entrada): Aviso[] {
  const avisos: Aviso[] = inventario ? avisosDeInventario(inventario, fecha) : []

  // Máximo de averías del contrato (1 % del DPP): el umbral lo decide el backend.
  if (averias?.total.excede) {
    avisos.push({
      clave: 'averias-sobre-limite',
      tono: 'critico',
      titulo: `Averías en ${porcentaje(averias.total.porcentaje, '—', 2)}`,
      texto: `Superan el máximo del ${averias.maximoPorcentaje} % de lo programado que permite el contrato.`,
      a: `/averias?desde=${fecha}&hasta=${fecha}`,
    })
  }
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
