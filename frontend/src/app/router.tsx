/**
 * RUTAS
 * =====
 *
 *   /login                   pública
 *   /                        panel de inicio
 *   /remisiones              listado
 *   /remisiones/nueva        crear   (va ANTES de /:id, igual que en el backend)
 *   /remisiones/:id          detalle + acciones de flujo
 *   /remisiones/:id/editar   corregir datos (BORRADOR / EN_RECTIFICACION)
 *   /admin/usuarios          administración
 *   /admin/productos         administración
 *
 * `RutaProtegida` envuelve al layout: si no hay sesión, ninguna ruta
 * hija se renderiza. La autorización fina (permisos) la hace el
 * backend; aquí el menú y los accesos solo se ocultan.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'

import { GruposPage } from '../modules/admin/pages/GruposPage'
import { LineasPage } from '../modules/admin/pages/LineasPage'
import { ProductosPage } from '../modules/admin/pages/ProductosPage'
import { ProgramacionPage } from '../modules/mfr/pages/ProgramacionPage'
import { TableroMfrPage } from '../modules/mfr/pages/TableroMfrPage'
import { UsuariosPage } from '../modules/admin/pages/UsuariosPage'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { RutaProtegida } from '../modules/auth/RutaProtegida'
import { CrearRemisionPage } from '../modules/remisiones/pages/CrearRemisionPage'
import { EditarRemisionPage } from '../modules/remisiones/pages/EditarRemisionPage'
import { RemisionDetallePage } from '../modules/remisiones/pages/RemisionDetallePage'
import { RemisionesListaPage } from '../modules/remisiones/pages/RemisionesListaPage'
import { AppLayout } from './layout/AppLayout'
import { InicioPage } from './pages/InicioPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <InicioPage /> },
          { path: 'remisiones', element: <RemisionesListaPage /> },
          { path: 'remisiones/nueva', element: <CrearRemisionPage /> },
          { path: 'remisiones/:id', element: <RemisionDetallePage /> },
          { path: 'remisiones/:id/editar', element: <EditarRemisionPage /> },
          { path: 'mfr', element: <TableroMfrPage /> },
          { path: 'mfr/programacion', element: <ProgramacionPage /> },
          // Ruta anterior de "configurar turno": ahora vive en la programación del día.
          { path: 'mfr/turno', element: <Navigate to="/mfr/programacion" replace /> },
          { path: 'admin/usuarios', element: <UsuariosPage /> },
          { path: 'admin/productos', element: <ProductosPage /> },
          { path: 'admin/lineas', element: <LineasPage /> },
          { path: 'admin/grupos', element: <GruposPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
