/**
 * TABLERO: ALERTAS DE INVENTARIO (/tableros/alertas-inventario)
 * =============================================================
 *
 * Agotados, PT sin receta, recetas con componente inactivo y lo que no
 * alcanza para el DPP del día. Antes era una pestaña de Inventario; salió
 * para dejar Inventario con la operación (usuario, 2026-10-06). El
 * contenido no cambió (`AlertasPage`, que lleva su propio día).
 */

import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoInventario } from '../../../components/Iconos'
import { AlertasPage } from '../../inventario/pages/AlertasPage'

export function TableroAlertasInventarioPage() {
  return (
    <section className="space-y-6">
      <EncabezadoPagina
        Icono={IconoInventario}
        escena="inventario"
        titulo="Alertas de inventario"
        descripcion="Lo que falta o impide producir: agotados, PT sin receta y lo que no alcanza para el DPP del día."
      />
      <AlertasPage />
    </section>
  )
}
