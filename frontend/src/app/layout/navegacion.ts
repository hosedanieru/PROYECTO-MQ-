/**
 * NAVEGACIÓN
 * ==========
 *
 * Una sola lista que alimenta la barra lateral. El panel de inicio usa
 * sus propios accesos (con descripción), pero el menú sale de aquí.
 *
 * Solo aparecen los módulos que existen. Cuando se implementen Averías,
 * Calidad o Inventario, se agregan aquí y aparecen en el menú sin tocar
 * ningún componente.
 *
 * `permiso` solo OCULTA el enlace: la autorización real la hace el
 * backend en cada petición.
 */

import type { ComponentType, SVGProps } from 'react'

import type { ClaveTexto } from '../../shared/idioma/textos/es'
import {
  IconoBalanza,
  IconoCaja,
  IconoCalendario,
  IconoInicio,
  IconoLinea,
  IconoPersonas,
  IconoRemision,
  IconoTablero,
  IconoUsuario,
} from '../../components/Iconos'

export interface EnlaceNav {
  a: string
  /** Clave del diccionario, no el texto: el menú cambia con el idioma. */
  texto: ClaveTexto
  /** Sin permiso = visible para cualquiera con sesión. */
  permiso?: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * `true` = el enlace solo se marca activo en su ruta exacta.
   * Necesario en `/` y en `/mfr`, que son prefijo de otras rutas.
   */
  exacta?: boolean
}

export interface SeccionNav {
  titulo?: ClaveTexto
  enlaces: EnlaceNav[]
}

export const NAVEGACION: SeccionNav[] = [
  {
    enlaces: [
      { a: '/', texto: 'nav.inicio', Icono: IconoInicio, exacta: true },
      { a: '/remisiones', texto: 'nav.remisiones', permiso: 'remision.consultar', Icono: IconoRemision },
      { a: '/mfr', texto: 'nav.mfr', permiso: 'mfr.consultar', Icono: IconoTablero, exacta: true },
      { a: '/mfr/programacion', texto: 'nav.programacion', permiso: 'mfr.consultar', Icono: IconoCalendario },
    ],
  },
  {
    titulo: 'nav.administracion',
    enlaces: [
      { a: '/admin/productos', texto: 'nav.productos', permiso: 'catalogo.editar', Icono: IconoCaja },
      { a: '/admin/lineas', texto: 'nav.lineas', permiso: 'catalogo.editar', Icono: IconoLinea },
      { a: '/admin/pesos', texto: 'nav.pesos', permiso: 'catalogo.editar_estandares', Icono: IconoBalanza },
      { a: '/admin/grupos', texto: 'nav.grupos', permiso: 'catalogo.editar', Icono: IconoPersonas },
      { a: '/admin/usuarios', texto: 'nav.usuarios', permiso: 'admin.usuarios', Icono: IconoUsuario },
    ],
  },
]
