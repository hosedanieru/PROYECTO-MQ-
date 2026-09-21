/**
 * Proveedores globales, de afuera hacia adentro:
 *   QueryClient  caché de peticiones (TanStack Query)
 *   Sesión       usuario actual y permisos
 *   Router       navegación
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { SesionProvider } from '../modules/auth/SesionContext'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 401/403/404 no se arregla reintentando.
      retry: false,
      // Datos de operación: no refrescar solo por cambiar de pestaña.
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <SesionProvider>
        <RouterProvider router={router} />
      </SesionProvider>
    </QueryClientProvider>
  )
}
