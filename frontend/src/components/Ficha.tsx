import type { ReactNode } from 'react'

/**
 * Ficha de datos: los datos de un documento en una franja, separados por
 * líneas verticales, como una hoja técnica. Reemplaza a la `Tarjeta` que
 * envolvía una rejilla de `Dato` (usuario, 2026-10-05: fuera las tarjetas).
 *
 * En celular pasa a dos columnas; desde tablet, una sola fila que se
 * parte si no cabe. Los hijos son `Dato`.
 */
export function Ficha({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-borde pb-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-4 [&>div]:sm:border-l [&>div]:sm:border-borde [&>div]:sm:px-6 [&>div:first-child]:sm:border-l-0 [&>div:first-child]:sm:pl-0">
      {children}
    </dl>
  )
}
