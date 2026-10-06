/**
 * Consultas y mutaciones del correo.
 *
 * Claves de caché:
 *   ['correo', 'listas']                  listas de distribución
 *   ['correo', 'envios', desde, hasta]    registro de envíos
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { DatosEnvioRemisiones, DatosLista } from '../../../shared/types/correo'
import { correoApi } from '../api/correo.api'

export function useListasDistribucion(habilitado = true) {
  return useQuery({ queryKey: ['correo', 'listas'], queryFn: correoApi.listas, enabled: habilitado })
}

export function useGuardarLista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: Partial<DatosLista> & { activo?: boolean } }) =>
      id ? correoApi.actualizarLista(id, datos) : correoApi.crearLista(datos as DatosLista),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['correo', 'listas'] }),
  })
}

export function useEnviosCorreo(desde: string, hasta: string, habilitado = true) {
  return useQuery({ queryKey: ['correo', 'envios', desde, hasta], queryFn: () => correoApi.envios(desde, hasta), enabled: habilitado })
}

/** Un envío (salga o falle) queda en el registro: se refresca. */
export function useEnviarRemisiones() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosEnvioRemisiones) => correoApi.enviarRemisiones(datos),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['correo', 'envios'] }),
  })
}
