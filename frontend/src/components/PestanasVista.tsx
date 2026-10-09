import type { ComponentType, ReactNode, SVGProps } from 'react'

import { COLOR_TONO, type TonoBadge } from './Badge'

export interface OpcionVista<T extends string> {
  clave: T
  titulo: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  /** Resumen vivo debajo del título ("3 PT bajo la meta"): dice qué hay antes de entrar. */
  resumen?: ReactNode
  /** Punto de color junto al resumen (el estado de esa vista). */
  tono?: TonoBadge
}

interface Props<T extends string> {
  opciones: OpcionVista<T>[]
  activa: T
  cambiar: (clave: T) => void
  /** Nombre para lectores de pantalla ("Vistas del tablero"). */
  etiqueta: string
}

/**
 * PESTAÑAS DE VISTA
 * =================
 *
 * Decisión del usuario (2026-10-05): fuera las tarjetas. Una pantalla
 * con mucha información se parte en VISTAS, y se ve una a la vez a todo
 * el ancho. Estas pestañas son la puerta: grandes (se tocan bien en una
 * tablet) y cada una con un resumen vivo, para que el coordinador sepa
 * dónde está el problema sin abrir todas.
 *
 * No son cajas: una línea de base corre a todo el ancho y la pestaña
 * activa la "enciende" con una barra de la marca y su resplandor.
 *
 * Solo dibuja: la vista activa la decide la pantalla (normalmente en la
 * URL, `?vista=`, como los filtros).
 */
/** Columnas en pantalla mediana según cuántas vistas hay: con 2 o 3 pestañas no queda espacio vacío. */
const COLUMNAS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  // Cinco no caben en una fila de tablet: 3 + 2 en pantalla mediana, las 5 juntas desde 1280 px.
  5: 'md:grid-cols-3 xl:grid-cols-5',
}

export function PestanasVista<T extends string>({ opciones, activa, cambiar, etiqueta }: Props<T>) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={`grid grid-cols-2 border-b-2 border-borde ${COLUMNAS[opciones.length] ?? 'md:grid-cols-4'}`}
    >
      {opciones.map(({ clave, titulo, Icono, resumen, tono }) => {
        const elegida = clave === activa
        return (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={elegida}
            onClick={() => cambiar(clave)}
            className={`group relative -mb-0.5 flex items-center gap-3 px-3 py-4 text-left transition sm:px-4 ${
              elegida ? 'text-tinta' : 'text-tinta-suave hover:text-tinta'
            }`}
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${
                elegida
                  ? 'bg-linear-to-br from-marca-relleno to-marca-relleno-hover text-white shadow-[0_8px_20px_-8px_var(--color-marca)]'
                  : 'bg-velo text-tinta-suave group-hover:bg-marca-claro group-hover:text-marca-texto'
              }`}
            >
              <Icono className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              {/* text-[1rem] y no text-base: `text-base` aquí pinta de blanco (ver la nota en index.css). */}
              <span className="block text-[1rem] font-black tracking-tight sm:text-lg">{titulo}</span>
              {resumen && (
                <span className="flex items-center gap-1.5 truncate text-xs font-medium text-tinta-suave">
                  {tono && (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLOR_TONO[tono] }} aria-hidden="true" />
                  )}
                  {resumen}
                </span>
              )}
            </span>
            {/* Barra inferior: se "enciende" en la pestaña activa. */}
            <span
              className={`absolute inset-x-2 bottom-0 h-1 rounded-full transition ${
                elegida ? 'bg-marca shadow-[0_0_14px_var(--color-marca)]' : 'bg-transparent group-hover:bg-borde'
              }`}
              aria-hidden="true"
            />
          </button>
        )
      })}
    </div>
  )
}
