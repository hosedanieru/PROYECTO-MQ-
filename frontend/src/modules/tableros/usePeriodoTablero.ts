/**
 * Periodo de un tablero, en la URL (`?periodo=dia|semana|mes&fecha=`),
 * como los filtros: el enlace se puede compartir y sobrevive a recargar.
 *
 *   dia     solo la fecha elegida
 *   semana  los 7 días operativos que terminan en la fecha
 *   mes     del día 1 del mes de la fecha hasta la fecha
 *
 * La fecha por defecto es el día operativo en curso (corte 06:00).
 */

import { useSearchParams } from 'react-router-dom'

import { fechaOperativaDe } from '../../shared/utils/fechas'

export type Periodo = 'dia' | 'semana' | 'mes'

export const PERIODOS: Array<{ valor: Periodo; texto: string }> = [
  { valor: 'dia', texto: 'Día' },
  { valor: 'semana', texto: '7 días' },
  { valor: 'mes', texto: 'Mes' },
]

/** YYYY-MM-DD desplazado N días (fecha de solo día: en UTC). */
function moverDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

export interface PeriodoTablero {
  periodo: Periodo
  fecha: string
  desde: string
  hasta: string
  esHoy: boolean
  cambiarPeriodo: (p: Periodo) => void
  cambiarFecha: (f: string) => void
}

export function usePeriodoTablero(): PeriodoTablero {
  const [params, setParams] = useSearchParams()
  const periodo: Periodo = PERIODOS.some((p) => p.valor === params.get('periodo')) ? (params.get('periodo') as Periodo) : 'dia'
  const hoy = fechaOperativaDe(new Date())
  const fecha = params.get('fecha') || hoy
  const desde = periodo === 'semana' ? moverDias(fecha, -6) : periodo === 'mes' ? `${fecha.slice(0, 8)}01` : fecha

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params)
    siguiente.set(clave, valor)
    setParams(siguiente, { replace: true })
  }

  return {
    periodo,
    fecha,
    desde,
    hasta: fecha,
    esHoy: fecha === hoy,
    cambiarPeriodo: (p) => cambiar('periodo', p),
    cambiarFecha: (f) => cambiar('fecha', f),
  }
}
