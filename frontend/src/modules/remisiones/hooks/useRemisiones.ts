/**
 * Hooks de datos del módulo. Encapsulan las claves de caché para que
 * una mutación (crear, entregar...) invalide exactamente lo que toca:
 * el listado y el detalle de esa remisión.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { EditarRemisionDatos, FiltroRemisiones } from '../../../shared/types/remision'
import { remisionesApi } from '../api/remisiones.api'

const CLAVE = 'remisiones'

export function useRemisiones(filtro: FiltroRemisiones) {
  return useQuery({
    queryKey: [CLAVE, 'lista', filtro],
    queryFn: () => remisionesApi.listar(filtro),
    placeholderData: (anterior) => anterior, // no parpadear al cambiar de página
  })
}

export function useRemision(id: string | undefined) {
  return useQuery({
    queryKey: [CLAVE, 'detalle', id],
    queryFn: () => remisionesApi.obtener(id!),
    enabled: Boolean(id),
  })
}

export function useVersionesRemision(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: [CLAVE, 'versiones', id],
    queryFn: () => remisionesApi.versiones(id),
    enabled: habilitado,
  })
}

export function useAuditoriaRemision(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: [CLAVE, 'auditoria', id],
    queryFn: () => remisionesApi.auditoria(id),
    enabled: habilitado,
  })
}

export function useCrearRemision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: remisionesApi.crear,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] }),
  })
}

export function useEditarRemision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cambios: EditarRemisionDatos) => remisionesApi.editar(id, cambios),
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
    },
  })
}

/**
 * Una sola mutación para las cinco transiciones. Cada acción recibe el
 * id y, si aplica, sus datos; al terminar refresca lista y detalle.
 */
export type AccionRemision =
  | { tipo: 'entregar' }
  | { tipo: 'aprobar'; opaNombre: string; opaCargo?: string }
  | { tipo: 'rechazar'; motivo: string }
  | { tipo: 'rectificar' }
  | { tipo: 'validar'; concilidadoCon: string }

export function useAccionRemision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accion: AccionRemision) => {
      switch (accion.tipo) {
        case 'entregar':
          return remisionesApi.entregar(id)
        case 'aprobar':
          return remisionesApi.aprobar(id, { opaNombre: accion.opaNombre, opaCargo: accion.opaCargo })
        case 'rechazar':
          return remisionesApi.rechazar(id, { motivo: accion.motivo })
        case 'rectificar':
          return remisionesApi.rectificar(id)
        case 'validar':
          return remisionesApi.validar(id, { concilidadoCon: accion.concilidadoCon })
      }
    },
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'versiones', id] })
    },
  })
}
