import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { mfrApi } from '../api/mfr.api'

const CLAVE = 'mfr'

/** Invalida todo lo del módulo: tablero, bloques y catálogos. */
function useInvalidarDia() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: [CLAVE] })
}

export function useIndicadoresDia(fecha: string) {
  return useQuery({ queryKey: [CLAVE, 'dia', fecha], queryFn: () => mfrApi.dia(fecha), enabled: Boolean(fecha) })
}

export function useGuardarBloque() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.guardarBloque, onSuccess: invalidar })
}

export function useEliminarBloque() {
  const invalidar = useInvalidarDia()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => mfrApi.eliminarBloque(id, motivo),
    onSuccess: invalidar,
  })
}

export function useCargarDia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.cargarDia, onSuccess: invalidar })
}

export function useCopiarDia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.copiarDia, onSuccess: invalidar })
}

export function useCerrarTurno() {
  const invalidar = useInvalidarDia()
  return useMutation({
    mutationFn: ({ fechaOperativa, turnoId, motivoFaltante }: { fechaOperativa: string; turnoId: string; motivoFaltante?: string }) =>
      mfrApi.cerrarTurno(fechaOperativa, turnoId, motivoFaltante),
    onSuccess: invalidar,
  })
}

export function useRegistrarAsistencia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.registrarAsistencia, onSuccess: invalidar })
}

export function useAsignarGrupoLinea() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.asignarGrupoLinea, onSuccess: invalidar })
}

export function useQuitarAsignacion() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.quitarAsignacion, onSuccess: invalidar })
}

export function useAnalizarDpp() {
  return useMutation({ mutationFn: mfrApi.analizarDpp })
}

export function useLineas() {
  return useQuery({ queryKey: [CLAVE, 'lineas'], queryFn: mfrApi.lineas, staleTime: 5 * 60 * 1000 })
}

export function useEstandares() {
  return useQuery({ queryKey: [CLAVE, 'estandares'], queryFn: mfrApi.estandares, staleTime: 60 * 1000 })
}
