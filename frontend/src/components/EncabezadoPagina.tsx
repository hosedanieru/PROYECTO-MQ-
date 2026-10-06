import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link } from 'react-router-dom'

import { HeroVisual3D, type TemaEscena } from '../shared/visual3d/HeroVisual3D'

interface Props {
  titulo: string
  /** Escena 3D del módulo (bolsas, remisión, cono, estiba, banda…). Por defecto, empaque. */
  escena?: TemaEscena
  /** Pantallas de detalle o formulario: enlace pequeño encima del título ("← Remisiones"). */
  volver?: { a: string; texto: string }
  /** Junto al título: estado o versión del documento (`EstadoBadge`, `Badge`). */
  insignia?: ReactNode
  /** Una frase: qué se hace en esta pantalla. Es la ayuda que más se lee. */
  descripcion?: ReactNode
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * Botones a la derecha. Van sobre fondo oscuro: usar las variantes
   * `claro` (acción principal) y `vidrio` (secundarias) de `Boton`.
   */
  acciones?: ReactNode
  /** Dentro de la banda, debajo del título: cifras del módulo (`CifraEstado` en variante vidrio). */
  children?: ReactNode
}

/**
 * Encabezado de toda pantalla de módulo: una banda "hero".
 *
 * Fija la jerarquía en todos los módulos: dónde estoy (ícono y título),
 * para qué sirve (descripción), qué puedo hacer (acciones) y cómo va
 * (cifras). Antes cada pantalla escribía su propio `<h1>` y el usuario
 * sentía que cambiaba de aplicación al pasar de un módulo a otro.
 *
 * Lo visual (degradado, rejilla, luces que derivan, empaque 3D; en
 * celular, ícono en marca de agua) es decoración pura: va con
 * `aria-hidden` y `pointer-events-none` para que no estorbe a un lector
 * de pantalla ni a un clic.
 *
 * La usan TODAS las pantallas del aplicativo (2026-10-05), también las
 * de detalle (`volver`, `insignia`) y las de formulario (solo la banda:
 * el formulario no se rediseña sin consultar al usuario).
 *
 * Solo dibuja: no trae datos ni conoce el negocio.
 */
export function EncabezadoPagina({ titulo, escena, volver, insignia, descripcion, Icono, acciones, children }: Props) {
  return (
    <header className="hero relative isolate overflow-hidden rounded-3xl px-5 py-6 text-white shadow-elevada sm:px-8 sm:py-8">
      {/* ---------- Decoración ---------- */}
      <div className="hero-rejilla pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <span
        className="luz -right-16 -top-24 -z-10 h-72 w-72 bg-marca opacity-70"
        aria-hidden="true"
      />
      <span
        className="luz -bottom-28 left-1/3 -z-10 h-64 w-64 bg-acento opacity-40 [animation-delay:-7s]"
        aria-hidden="true"
      />
      {/* En celular (sin figura 3D) queda el ícono en marca de agua. */}
      <Icono
        className="pointer-events-none absolute -right-6 -top-6 -z-10 h-56 w-56 rotate-12 text-white opacity-[0.06] sm:hidden"
        aria-hidden="true"
      />
      {/*
        Figura 3D a la derecha, detrás del contenido. Desborda la banda por
        arriba y por abajo (se recorta en el borde redondeado) para que se
        vea grande aunque la banda sea baja; detrás de las cifras se lee a
        través del vidrio. La máscara la funde hacia la izquierda para que
        sus reflejos no caigan bajo el título.
      */}
      <HeroVisual3D tema={escena} className="absolute -inset-y-20 -right-10 -z-10 w-[26rem] [mask-image:linear-gradient(to_left,black_55%,transparent)] lg:w-[32rem]" />

      {/* ---------- Contenido ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="vidrio grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-[0_0_40px_-6px_var(--color-marca)]">
            <Icono className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            {volver && (
              <Link to={volver.a} className="text-sm font-medium text-white/90 hover:text-white hover:underline">
                ← {volver.texto}
              </Link>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{titulo}</h1>
              {insignia}
            </div>
            {descripcion && <p className="mt-1 max-w-2xl text-sm text-white/90">{descripcion}</p>}
          </div>
        </div>
        {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
      </div>

      {children && <div className="mt-6">{children}</div>}
    </header>
  )
}
