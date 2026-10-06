import type { HTMLAttributes, ReactNode } from 'react'

import { useAparecer } from '../shared/animacion/useAnimacion'
import type { TonoBadge } from './Badge'

/**
 * TABLA
 * =====
 *
 * Piezas de tabla con el mismo aspecto en todos los módulos. No es una
 * tabla "genérica" que recibe columnas por configuración: cada pantalla
 * sigue escribiendo sus `<td>`, que es lo más fácil de leer y cambiar.
 * Esto solo fija el marco, el encabezado, la carga y la franja de estado.
 */

interface PropsTabla {
  /** Títulos de columna. `derecha` alinea cifras a la derecha. */
  columnas: { texto: ReactNode; derecha?: boolean; clave?: string }[]
  /** Mientras carga se dibujan filas grises en lugar de "Cargando…". */
  cargando?: boolean
  /** Se muestra en lugar de las filas cuando no hay ninguna (y no está cargando). */
  vacio?: ReactNode
  estaVacia?: boolean
  /**
   * Cuando cambia (filtro, página), las filas vuelven a entrar en
   * cascada. Sin ella, solo entran al montar.
   */
  claveAnimacion?: string
  children?: ReactNode
}

export function Tabla({
  columnas,
  cargando = false,
  vacio,
  estaVacia = false,
  claveAnimacion = '',
  children,
}: PropsTabla) {
  const mostrarVacio = !cargando && estaVacia
  // `cargando` entra en la clave: al llegar los datos, las filas reales hacen su entrada.
  const cuerpo = useAparecer<HTMLTableSectionElement>(`${cargando}|${claveAnimacion}`)

  return (
    // Sin caja (usuario, 2026-10-05: fuera las tarjetas): la tabla va sobre el fondo, entre dos líneas finas.
    <div className="relative border-y border-borde">
      {mostrarVacio ? (
        vacio
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b-2 border-borde">
              <tr>
                {columnas.map((c, i) => (
                  <th
                    key={c.clave ?? i}
                    scope="col"
                    className={`whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-tinta-suave ${
                      c.derecha ? 'text-right' : 'text-left'
                    }`}
                  >
                    {c.texto}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={cuerpo} className="divide-y divide-borde">
              {cargando ? <FilasCargando columnas={columnas.length} /> : children}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/** Barras grises animadas: dicen "ya viene" sin mover el diseño cuando llegan los datos. */
function FilasCargando({ columnas, filas = 6 }: { columnas: number; filas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, f) => (
        <tr key={f} aria-hidden="true">
          {Array.from({ length: columnas }, (_, c) => (
            <td key={c} className="px-4 py-4">
              <span className="block h-3 animate-pulse rounded-full bg-borde" style={{ width: `${50 + ((f + c) % 4) * 12}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/*
 * Franja de color en el borde izquierdo de la fila. Se pinta sobre la
 * primera celda con una sombra interior porque un `<tr>` no dibuja bordes
 * propios de forma confiable en todos los navegadores.
 */
const FRANJA_FILA: Record<TonoBadge, string> = {
  neutro: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-neutro)]',
  marca: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-marca)]',
  exito: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-exito)]',
  alerta: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-alerta)]',
  critico: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-critico)]',
  acento: '[&>td:first-child]:shadow-[inset_4px_0_0_var(--color-acento)]',
}

interface PropsFila extends HTMLAttributes<HTMLTableRowElement> {
  /** Color de la franja izquierda (el estado del registro). */
  tono?: TonoBadge
  /** Fila marcada (seleccionada). */
  marcada?: boolean
}

export function FilaTabla({ tono, marcada = false, className = '', children, ...resto }: PropsFila) {
  return (
    <tr
      data-animar
      className={`transition-colors duration-200 ${tono ? FRANJA_FILA[tono] : ''} ${
        marcada ? 'bg-marca-claro/60' : 'hover:bg-linear-to-r hover:from-marca-claro/70 hover:to-transparent'
      } ${className}`}
      {...resto}
    >
      {children}
    </tr>
  )
}

/** Celda con el relleno estándar. `derecha` para cifras. */
export function Celda({
  derecha = false,
  className = '',
  children,
  ...resto
}: HTMLAttributes<HTMLTableCellElement> & { derecha?: boolean }) {
  return (
    <td className={`px-4 py-3 align-middle ${derecha ? 'cifra text-right' : ''} ${className}`} {...resto}>
      {children}
    </td>
  )
}
