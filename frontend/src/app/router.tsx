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
 *   /mfr/tv                  modo TV del tablero MFR (pantalla completa, SIN el layout)
 *   /admin/usuarios          administración
 *   /admin/pesos             pesos por caja en lote (estándar del MFR)
 *   /admin/causales          causales de avería (lista del formulario)
 *   /admin/correos           listas de distribución de correo y registro de envíos
 *   /averias                 listado de reportes de averías
 *   /averias/nuevo           formulario (va ANTES de /:id)
 *   /averias/:id             detalle con fotos; corregir / anular (administrador)
 *   /inventario              UN SOLO MÓDULO (pestañas, `InventarioLayout`):
 *     (índice)               existencias de insumos, PI y PT; registrar movimiento
 *     /alertas               alertas del día: sin receta, agotado, no alcanza para el DPP…
 *     /cierre                cierre del día: conteo físico de los materiales de las recetas y su merma
 *     /entradas              entradas de mercancía (listado; /nueva formulario; /:id detalle)
 *     /pt                    catálogo de PT (tabla `producto`; antes /admin/productos)
 *     /pi, /insumos          catálogo de PI y de insumos (una tabla cada uno)
 *     /unidades              unidades de medida (lista desplegable)
 *     /:id                   kardex de un ítem
 *
 * `RutaProtegida` envuelve al layout: si no hay sesión, ninguna ruta
 * hija se renderiza. La autorización fina (permisos) la hace el
 * backend; aquí el menú y los accesos solo se ocultan.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'

import { CausalesPage } from '../modules/admin/pages/CausalesPage'
import { CorreosPage } from '../modules/correo/pages/CorreosPage'
import { GruposPage } from '../modules/admin/pages/GruposPage'
import { AlertasPage } from '../modules/inventario/pages/AlertasPage'
import { CierrePage } from '../modules/inventario/pages/CierrePage'
import { InventarioPage } from '../modules/inventario/pages/InventarioPage'
import { EntradaDetallePage } from '../modules/inventario/pages/EntradaDetallePage'
import { EntradasPage } from '../modules/inventario/pages/EntradasPage'
import { InventarioLayout } from '../modules/inventario/InventarioLayout'
import { KardexPage } from '../modules/inventario/pages/KardexPage'
import { NuevaEntradaPage } from '../modules/inventario/pages/NuevaEntradaPage'
import { MaterialesPage } from '../modules/inventario/pages/MaterialesPage'
import { UnidadesPage } from '../modules/inventario/pages/UnidadesPage'
import { AveriasListaPage } from '../modules/averias/pages/AveriasListaPage'
import { NuevoReporteAveriaPage } from '../modules/averias/pages/NuevoReporteAveriaPage'
import { ReporteAveriaDetallePage } from '../modules/averias/pages/ReporteAveriaDetallePage'
import { LineasPage } from '../modules/admin/pages/LineasPage'
import { PesosPage } from '../modules/admin/pages/PesosPage'
import { ProductosPage } from '../modules/inventario/pages/ProductosPage'
import { ProgramacionPage } from '../modules/mfr/pages/ProgramacionPage'
import { TableroMfrPage } from '../modules/mfr/pages/TableroMfrPage'
import { TableroTvPage } from '../modules/mfr/pages/TableroTvPage'
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
      // Modo TV: fuera del AppLayout a propósito (sin menú ni barra superior).
      { path: 'mfr/tv', element: <TableroTvPage /> },
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
          { path: 'averias', element: <AveriasListaPage /> },
          { path: 'averias/nuevo', element: <NuevoReporteAveriaPage /> },
          { path: 'averias/:id', element: <ReporteAveriaDetallePage /> },
          {
            // Un solo módulo: existencias, entradas, productos (PT) y PI/insumos.
            path: 'inventario',
            element: <InventarioLayout />,
            children: [
              { index: true, element: <InventarioPage /> },
              { path: 'alertas', element: <AlertasPage /> },
              { path: 'cierre', element: <CierrePage /> },
              { path: 'entradas', element: <EntradasPage /> },
              { path: 'entradas/nueva', element: <NuevaEntradaPage /> },
              { path: 'entradas/:id', element: <EntradaDetallePage /> },
              // Una tabla por tipo, una pestaña por tipo (usuario, 2026-09-29).
              { path: 'pt', element: <ProductosPage /> },
              { path: 'pi', element: <MaterialesPage tipo="PI" /> },
              { path: 'insumos', element: <MaterialesPage tipo="INSUMO" /> },
              { path: 'unidades', element: <UnidadesPage /> },
              // Rutas anteriores dentro del módulo.
              { path: 'productos', element: <Navigate to="/inventario/pt" replace /> },
              { path: 'catalogo', element: <Navigate to="/inventario/pi" replace /> },
              { path: ':id', element: <KardexPage /> },
            ],
          },
          // Rutas anteriores: productos e ítems ahora viven dentro de Inventario.
          { path: 'admin/productos', element: <Navigate to="/inventario/pt" replace /> },
          { path: 'admin/inventario', element: <Navigate to="/inventario/pi" replace /> },
          { path: 'admin/usuarios', element: <UsuariosPage /> },
          { path: 'admin/lineas', element: <LineasPage /> },
          { path: 'admin/grupos', element: <GruposPage /> },
          { path: 'admin/pesos', element: <PesosPage /> },
          { path: 'admin/causales', element: <CausalesPage /> },
          { path: 'admin/correos', element: <CorreosPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
