/**
 * NAVEGACIÓN
 * ==========
 *
 * Una sola lista que alimenta la barra superior (y su panel en celular).
 * El panel de inicio usa sus propios accesos (con descripción), pero el
 * menú sale de aquí.
 *
 * Decisión del usuario (2026-10-05): la navegación pasó de la barra
 * lateral a la parte SUPERIOR, para devolverle ese ancho al contenido,
 * sin quitar nada y sin barra de desplazamiento. Para que quepa, los
 * enlaces que van juntos se agrupan en un menú desplegable:
 *
 *   Inicio · Remisiones · Producción ▾ · Averías · Inventario · Administración ▾
 *
 * Solo aparecen los módulos que existen. Un módulo nuevo se agrega aquí
 * (suelto o dentro de un grupo) y aparece en el menú sin tocar ningún
 * componente.
 *
 * `permiso` solo OCULTA el enlace: la autorización real la hace el
 * backend en cada petición.
 */

import type { ComponentType, SVGProps } from 'react'

import type { ClaveTexto } from '../../shared/idioma/textos/es'
import {
  IconoAveria,
  IconoBalanza,
  IconoCalendario,
  IconoInicio,
  IconoInventario,
  IconoLinea,
  IconoCorreo,
  IconoLista,
  IconoPersonas,
  IconoPlanta,
  IconoRemision,
  IconoTablero,
  IconoUsuario,
} from '../../components/Iconos'

type Icono = ComponentType<SVGProps<SVGSVGElement>>

export interface EnlaceNav {
  a: string
  /** Clave del diccionario, no el texto: el menú cambia con el idioma. */
  texto: ClaveTexto
  /** Sin permiso = visible para cualquiera con sesión. */
  permiso?: string
  Icono: Icono
  /**
   * `true` = el enlace solo se marca activo en su ruta exacta.
   * Necesario en `/` y en `/mfr`, que son prefijo de otras rutas.
   */
  exacta?: boolean
}

/** Varios enlaces bajo un solo botón con menú desplegable. */
export interface GrupoNav {
  texto: ClaveTexto
  Icono: Icono
  enlaces: EnlaceNav[]
}

export type ElementoNav = { enlace: EnlaceNav } | { grupo: GrupoNav }

export const NAVEGACION: ElementoNav[] = [
  { enlace: { a: '/', texto: 'nav.inicio', Icono: IconoInicio, exacta: true } },
  { enlace: { a: '/remisiones', texto: 'nav.remisiones', permiso: 'remision.consultar', Icono: IconoRemision } },
  {
    grupo: {
      texto: 'nav.produccion',
      Icono: IconoPlanta,
      enlaces: [
        { a: '/mfr', texto: 'nav.mfr', permiso: 'mfr.consultar', Icono: IconoTablero, exacta: true },
        { a: '/mfr/programacion', texto: 'nav.programacion', permiso: 'mfr.consultar', Icono: IconoCalendario },
      ],
    },
  },
  { enlace: { a: '/averias', texto: 'nav.averias', permiso: 'averia.consultar', Icono: IconoAveria } },
  // Un solo módulo (2026-09-29): productos, PI, insumos, entradas y existencias van en pestañas adentro.
  { enlace: { a: '/inventario', texto: 'nav.inventario', permiso: 'inventario.consultar', Icono: IconoInventario } },
  {
    grupo: {
      texto: 'nav.administracion',
      Icono: IconoUsuario,
      enlaces: [
        { a: '/admin/lineas', texto: 'nav.lineas', permiso: 'catalogo.editar', Icono: IconoLinea },
        { a: '/admin/pesos', texto: 'nav.pesos', permiso: 'catalogo.editar_estandares', Icono: IconoBalanza },
        { a: '/admin/grupos', texto: 'nav.grupos', permiso: 'catalogo.editar', Icono: IconoPersonas },
        { a: '/admin/causales', texto: 'nav.causales', permiso: 'catalogo.editar', Icono: IconoLista },
        { a: '/admin/correos', texto: 'nav.correos', permiso: 'admin.correos', Icono: IconoCorreo },
        { a: '/admin/usuarios', texto: 'nav.usuarios', permiso: 'admin.usuarios', Icono: IconoUsuario },
      ],
    },
  },
]

/**
 * La navegación que ve este usuario: sin los enlaces que no puede abrir
 * y sin los grupos que quedaron vacíos.
 */
export function navegacionVisible(tienePermiso: (permiso: string) => boolean): ElementoNav[] {
  const puede = (e: EnlaceNav) => !e.permiso || tienePermiso(e.permiso)
  return NAVEGACION.flatMap((el): ElementoNav[] => {
    if ('enlace' in el) return puede(el.enlace) ? [el] : []
    const enlaces = el.grupo.enlaces.filter(puede)
    return enlaces.length > 0 ? [{ grupo: { ...el.grupo, enlaces } }] : []
  })
}

/** ¿El enlace corresponde a la ruta actual? (`exacta` solo en su ruta; si no, también en sus subrutas). */
export function enlaceActivo(enlace: EnlaceNav, ruta: string): boolean {
  if (enlace.exacta) return ruta === enlace.a
  return ruta === enlace.a || ruta.startsWith(`${enlace.a}/`)
}
