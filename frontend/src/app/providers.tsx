/**
 * Proveedores globales, de afuera hacia adentro:
 *   Motion       configuración de las animaciones (respeta "reducir movimiento")
 *   Idioma       español / inglés (cualquiera puede pedir un texto)
 *   Tema         claro / oscuro
 *   QueryClient  caché de peticiones (TanStack Query)
 *   Sesión       usuario actual y permisos
 *   Router       navegación
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'

import { SesionProvider } from '../modules/auth/SesionContext'
import { MotionConfig } from '../shared/animacion/movimiento'
import { IdiomaProvider } from '../shared/idioma/IdiomaProvider'
import { REFRESCO_NORMAL } from '../shared/refresco'
import { TemaProvider } from '../shared/tema/TemaProvider'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Un 401/403/404 no se arregla reintentando.
      retry: false,
      // Datos de operación: no refrescar solo por cambiar de pestaña.
      refetchOnWindowFocus: false,
      /*
       * Ritmo por defecto. NO se baja aquí: este valor aplica a TODAS
       * las consultas de TODAS las pantallas a la vez, y en Firestore
       * cada listado de remisiones lee el día entero y filtra en memoria
       * (`consultarFiltradas` en el repositorio), así que cada consulta
       * cuesta una lectura completa del día, facturada por documento.
       *
       * Para que una pantalla vaya más rápido, se le pasa su intervalo a
       * la consulta que lo necesita. Ver `shared/refresco.ts`.
       */
      refetchInterval: REFRESCO_NORMAL,
    },
  },
})

export function Providers() {
  return (
    // Motion respeta "reducir movimiento" del sistema: sin animaciones de transformación, el dato aparece de una.
    <MotionConfig reducedMotion="user">
      <IdiomaProvider>
        <TemaProvider>
          <QueryClientProvider client={queryClient}>
            <SesionProvider>
              <RouterProvider router={router} />
            </SesionProvider>
          </QueryClientProvider>
        </TemaProvider>
      </IdiomaProvider>
    </MotionConfig>
  )
}
