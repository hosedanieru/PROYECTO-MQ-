/**
 * Catálogos de referencia en caché. Cambian rara vez, así que se
 * consideran frescos por 5 minutos: abrir el formulario de remisión
 * varias veces en un turno no vuelve a pedirlos.
 */

import { useQuery } from '@tanstack/react-query'

import { catalogoApi } from '../api/catalogo.api'

const CINCO_MINUTOS = 5 * 60 * 1000

export function useTurnos() {
  return useQuery({ queryKey: ['catalogo', 'turnos'], queryFn: catalogoApi.turnos, staleTime: CINCO_MINUTOS })
}

export function useGrupos() {
  return useQuery({ queryKey: ['catalogo', 'grupos'], queryFn: catalogoApi.grupos, staleTime: CINCO_MINUTOS })
}

export function useLugares() {
  return useQuery({ queryKey: ['catalogo', 'lugares'], queryFn: catalogoApi.lugares, staleTime: CINCO_MINUTOS })
}

export function useRoles() {
  return useQuery({ queryKey: ['catalogo', 'roles'], queryFn: catalogoApi.roles, staleTime: CINCO_MINUTOS })
}

export function useProductos(params: { texto?: string; soloActivos?: boolean } = {}) {
  return useQuery({
    queryKey: ['productos', params],
    queryFn: () => catalogoApi.productos(params),
    staleTime: 60 * 1000,
  })
}
