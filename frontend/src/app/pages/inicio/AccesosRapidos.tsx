import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'

import {
  IconoBalanza,
  IconoCaja,
  IconoCalendario,
  IconoLinea,
  IconoPersonas,
  IconoRemision,
  IconoTablero,
  IconoUsuario,
} from '../../../components/Iconos'

interface Acceso {
  a: string
  titulo: string
  descripcion: string
  permiso: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
}

const ACCESOS: Acceso[] = [
  {
    a: '/remisiones/nueva',
    titulo: 'Nueva remisión',
    descripcion: 'Registrar una entrega de producto terminado.',
    permiso: 'remision.crear',
    Icono: IconoRemision,
  },
  {
    a: '/remisiones',
    titulo: 'Remisiones',
    descripcion: 'Consultar, entregar, aprobar y conciliar.',
    permiso: 'remision.consultar',
    Icono: IconoRemision,
  },
  {
    a: '/mfr',
    titulo: 'MFR del día',
    descripcion: 'Cumplimiento contra el DPP, turnos y kilos por hora.',
    permiso: 'mfr.consultar',
    Icono: IconoTablero,
  },
  {
    a: '/mfr/programacion',
    titulo: 'Programación DPP',
    descripcion: 'Bloques por línea y hora: importar, copiar o editar.',
    permiso: 'mfr.consultar',
    Icono: IconoCalendario,
  },
  {
    a: '/admin/productos',
    titulo: 'Productos',
    descripcion: 'Catálogo, empaque, cajas por hora y peso por caja.',
    permiso: 'catalogo.editar',
    Icono: IconoCaja,
  },
  {
    a: '/admin/lineas',
    titulo: 'Líneas',
    descripcion: 'Plataformas del DPP, tipo y capacidad por hora.',
    permiso: 'catalogo.editar',
    Icono: IconoLinea,
  },
  {
    a: '/admin/pesos',
    titulo: 'Pesos por caja',
    descripcion: 'Confirmar en lote los kilos de cada producto.',
    permiso: 'catalogo.editar_estandares',
    Icono: IconoBalanza,
  },
  {
    a: '/admin/grupos',
    titulo: 'Grupos',
    descripcion: 'Personal esperado y asistencia de cada turno.',
    permiso: 'catalogo.editar',
    Icono: IconoPersonas,
  },
  {
    a: '/admin/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Cuentas, roles y contraseñas.',
    permiso: 'admin.usuarios',
    Icono: IconoUsuario,
  },
]

export function AccesosRapidos({ tienePermiso }: { tienePermiso: (permiso: string) => boolean }) {
  const visibles = ACCESOS.filter((acceso) => tienePermiso(acceso.permiso))

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visibles.map(({ a, titulo, descripcion, Icono }) => (
        <Link
          key={a}
          to={a}
          className="group flex gap-3 rounded-xl border border-borde bg-base p-4 transition duration-200 hover:-translate-y-0.5 hover:border-marca/30 hover:shadow-tarjeta"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-marca-claro text-marca-texto transition group-hover:bg-marca group-hover:text-white">
            <Icono />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-tinta">{titulo}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-tinta-suave">{descripcion}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
