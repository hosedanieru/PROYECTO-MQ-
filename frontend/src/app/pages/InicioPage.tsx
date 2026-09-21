/**
 * PANEL DE INICIO
 * ===============
 *
 * Accesos directos filtrados por permiso. Es el punto donde, cuando el
 * área defina las vistas por rol y área, se decidirá a qué pantalla
 * entra cada quien (equivalente a `resolverRuta` del app de recepción).
 */

import { Link } from 'react-router-dom'

import { useSesion } from '../../modules/auth/useSesion'

interface Acceso {
  a: string
  titulo: string
  descripcion: string
  permiso: string
}

const ACCESOS: Acceso[] = [
  { a: '/remisiones/nueva', titulo: 'Nueva remisión', descripcion: 'Registrar una entrega de producto terminado.', permiso: 'remision.crear' },
  { a: '/remisiones', titulo: 'Remisiones', descripcion: 'Consultar, entregar, aprobar y conciliar.', permiso: 'remision.consultar' },
  { a: '/mfr', titulo: 'MFR del día', descripcion: 'Cumplimiento contra el DPP de PepsiCo, turnos y kilos por hora.', permiso: 'mfr.consultar' },
  { a: '/mfr/programacion', titulo: 'Programación (DPP)', descripcion: 'Bloques por línea y hora: importar el PDF, copiar otro día o editar.', permiso: 'mfr.consultar' },
  { a: '/admin/productos', titulo: 'Productos', descripcion: 'Catálogo de ítems, empaque, cajas/hora y peso por caja.', permiso: 'catalogo.editar' },
  { a: '/admin/lineas', titulo: 'Líneas', descripcion: 'Plataformas del DPP: tipo, capacidad kg/h y orden.', permiso: 'catalogo.editar' },
  { a: '/admin/grupos', titulo: 'Grupos', descripcion: 'Quien pone el personal del turno: proveedor y personas esperadas.', permiso: 'catalogo.editar' },
  { a: '/admin/usuarios', titulo: 'Usuarios', descripcion: 'Cuentas, roles y contraseñas.', permiso: 'admin.usuarios' },
]

export function InicioPage() {
  const { usuario, tienePermiso } = useSesion()

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Hola, {usuario?.nombre}</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS.filter((a) => tienePermiso(a.permiso)).map((a) => (
          <Link
            key={a.a}
            to={a.a}
            className="rounded-lg bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{a.titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{a.descripcion}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
