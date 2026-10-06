import type { ComponentType, ReactNode, SVGProps } from 'react'

import { useAparecer } from '../shared/animacion/useAnimacion'
import { COLOR_TONO, type TonoBadge } from './Badge'

/**
 * LISTA DE REGISTROS — la alternativa a la tabla apretada
 * =======================================================
 *
 * Decisión del usuario (2026-10-05): fuera las tarjetas; la información
 * "se ve saturada y no cabe bien". Una tabla de 8 a 12 columnas dentro de
 * una caja obliga a leer de lado a lado y se corta en la tablet.
 *
 * Cada registro es una FILA ABIERTA, sin caja, separada por líneas finas:
 *
 *   ▌ [etiqueta] Título legible                          1.250  ← la cifra que importa
 *   ▌ detalle (código, descripción)                     metros
 *   ▌ dato · dato · dato  (lo secundario, en pequeño)     [acciones]
 *
 * La franja de color dice el estado desde lejos; el título se lee
 * completo; los datos secundarios bajan a una línea de etiquetas en vez
 * de abrir columnas; la cifra principal va grande a la derecha. En una
 * pantalla angosta la fila se acomoda hacia abajo en lugar de cortarse.
 *
 * Solo dibuja: cada pantalla decide qué va en cada lugar.
 */

interface PropsLista {
  /** Mientras carga se dibujan filas grises en lugar de "Cargando…". */
  cargando?: boolean
  /** Se muestra en lugar de las filas cuando no hay ninguna (y no está cargando). */
  vacio?: ReactNode
  estaVacia?: boolean
  /** Cuando cambia (filtro), las filas vuelven a entrar en cascada. */
  claveAnimacion?: string
  children?: ReactNode
}

export function ListaRegistros({ cargando = false, vacio, estaVacia = false, claveAnimacion = '', children }: PropsLista) {
  const lista = useAparecer<HTMLUListElement>(`${cargando}|${claveAnimacion}`)
  if (!cargando && estaVacia) return <div className="border-y border-borde">{vacio}</div>
  return (
    <ul ref={lista} className="divide-y divide-borde border-y border-borde">
      {cargando ? <FilasCargando /> : children}
    </ul>
  )
}

function FilasCargando() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex items-center gap-6 py-4 pl-5" aria-hidden="true">
          <div className="flex-1 space-y-2">
            <span className="block h-3.5 animate-pulse rounded-full bg-borde" style={{ width: `${40 + (i % 3) * 15}%` }} />
            <span className="block h-3 w-1/4 animate-pulse rounded-full bg-borde/70" />
          </div>
          <span className="h-6 w-16 animate-pulse rounded-lg bg-borde" />
        </li>
      ))}
    </>
  )
}

interface PropsFila {
  /** Color de la franja izquierda: el estado o el tipo del registro. */
  tono?: TonoBadge
  /** Insignia antes del título (tipo, gravedad). */
  etiqueta?: ReactNode
  titulo: ReactNode
  /** Segunda línea: código, descripción o mensaje. */
  detalle?: ReactNode
  /** Tercera línea: datos secundarios (`MetaDato`), en pequeño. */
  meta?: ReactNode
  /** Debajo de todo, a lo ancho: una barra de proporción, una nota. */
  pie?: ReactNode
  /** La cifra que importa, grande a la derecha. */
  cifra?: ReactNode
  unidad?: ReactNode
  /** Texto pequeño bajo la cifra ("en cero", "saldo 300"). */
  notaCifra?: ReactNode
  /** Clase de color de la cifra (`text-exito`, `text-critico`…). Por defecto, tinta. */
  colorCifra?: string
  acciones?: ReactNode
  /** Registro inactivo: título tachado en gris, sigue legible. Acompañar con una insignia "Inactivo". */
  apagada?: boolean
}

export function FilaRegistro({
  tono,
  etiqueta,
  titulo,
  detalle,
  meta,
  pie,
  cifra,
  unidad,
  notaCifra,
  colorCifra = 'text-tinta',
  acciones,
  apagada = false,
}: PropsFila) {
  return (
    <li
      data-animar
      className="group relative flex flex-wrap items-center gap-x-6 gap-y-3 py-4 pl-5 pr-2 transition-colors duration-200 hover:bg-linear-to-r hover:from-marca-claro/60 hover:to-transparent"
    >
      {tono && (
        <span
          className="absolute inset-y-3 left-0 w-1 rounded-full"
          style={{ backgroundColor: COLOR_TONO[tono] }}
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1 basis-72">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {etiqueta}
          {/* Inactivo: título en gris de texto secundario (no con transparencia, que bajaría el contraste por debajo de 4,5:1). */}
          <span className={`text-base font-bold leading-snug ${apagada ? 'text-tinta-suave line-through decoration-1' : 'text-tinta'}`}>
            {titulo}
          </span>
        </div>
        {detalle && <div className="mt-0.5 text-sm text-tinta-suave">{detalle}</div>}
        {meta && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">{meta}</div>}
        {pie && <div className="mt-2.5">{pie}</div>}
      </div>

      {cifra !== undefined && (
        <div className="min-w-24 text-right">
          <p className={`cifra text-2xl font-black leading-none tracking-tight ${colorCifra}`}>
            {cifra}
            {unidad && <span className="ml-1 text-xs font-semibold tracking-normal text-tinta-suave">{unidad}</span>}
          </p>
          {notaCifra && <p className="mt-1 text-xs text-tinta-suave">{notaCifra}</p>}
        </div>
      )}

      {acciones && <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{acciones}</div>}
    </li>
  )
}

interface PropsMeta {
  /** Nombre corto del dato ("Turno", "Recibió"). Se omite si el valor se explica solo. */
  etiqueta?: string
  Icono?: ComponentType<SVGProps<SVGSVGElement>>
  children: ReactNode
}

/** Un dato secundario dentro de la línea de etiquetas de la fila. */
export function MetaDato({ etiqueta, Icono, children }: PropsMeta) {
  return (
    <span className="inline-flex items-center gap-1">
      {Icono && <Icono className="h-3.5 w-3.5" aria-hidden="true" />}
      {etiqueta && <span>{etiqueta}</span>}
      <span className="font-semibold text-tinta">{children}</span>
    </span>
  )
}
