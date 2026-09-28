/**
 * Consultas y mutaciones de averías.
 *
 * Claves de caché:
 *   ['averias', 'causales']            catálogo de causales
 *   ['averias', 'lista', filtro]       listado
 *   ['averias', 'detalle', id]         un reporte
 *
 * Cada mutación invalida solo lo que toca.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { CambiosRegistroAveria, FiltroAverias, RegistroNuevoAveria } from '../../../shared/types/averia'
import { averiasApi } from '../api/averias.api'

const CINCO_MINUTOS = 5 * 60 * 1000

export function useCausales() {
  return useQuery({ queryKey: ['averias', 'causales'], queryFn: averiasApi.causales, staleTime: CINCO_MINUTOS })
}

export function useReportesAveria(filtro: FiltroAverias) {
  return useQuery({ queryKey: ['averias', 'lista', filtro], queryFn: () => averiasApi.listar(filtro) })
}

export function useReporteAveria(id: string) {
  return useQuery({ queryKey: ['averias', 'detalle', id], queryFn: () => averiasApi.detalle(id) })
}

export function useCrearReporteAveria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ grupoId, registros }: { grupoId: string; registros: RegistroNuevoAveria[] }) =>
      averiasApi.crear(grupoId, registros),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['averias', 'lista'] }),
  })
}

/** Corregir y anular cambian el reporte: se refresca su detalle y el listado. */
function useCambioReporte<A>(accion: (id: string, args: A) => ReturnType<typeof averiasApi.anular>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, args }: { id: string; args: A }) => accion(id, args),
    onSuccess: (reporte) => {
      qc.setQueryData(['averias', 'detalle', reporte.id], reporte)
      void qc.invalidateQueries({ queryKey: ['averias', 'lista'] })
    },
  })
}

export function useCorregirRegistroAveria() {
  return useCambioReporte<{ registroId: string; cambios: CambiosRegistroAveria }>((id, a) =>
    averiasApi.corregirRegistro(id, a.registroId, a.cambios),
  )
}

export function useAnularReporteAveria() {
  return useCambioReporte<string>((id, motivo) => averiasApi.anular(id, motivo))
}
