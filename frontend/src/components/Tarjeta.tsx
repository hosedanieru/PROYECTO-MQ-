import type { HTMLAttributes, ReactNode } from 'react'

type Tono = 'claro' | 'marino'

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Encabezado de la tarjeta. Si se omite, la tarjeta es solo el marco. */
  titulo?: ReactNode
  descripcion?: ReactNode
  /** Enlace o botón alineado a la derecha del título ("Ver detalle"). */
  accion?: ReactNode
  tono?: Tono
  /** Quita el relleno interno, para tarjetas que contienen una tabla a sangre. */
  sinRelleno?: boolean
  children?: ReactNode
}

const MARCO: Record<Tono, string> = {
  claro: 'border-borde bg-base text-tinta',
  // La marina es oscura en los dos temas: su borde se hace con blanco
  // translúcido, no con el token de borde (que se aclara en tema claro).
  marino: 'border-white/10 bg-marina text-white',
}

const TITULO: Record<Tono, string> = {
  claro: 'text-tinta',
  marino: 'text-white',
}

const DESCRIPCION: Record<Tono, string> = {
  claro: 'text-tinta-suave',
  marino: 'text-white/70',
}

/**
 * Marco estándar de todo bloque de contenido: borde, radio y sombra
 * iguales en toda la aplicación.
 *
 * No decide nada de negocio ni trae datos; solo dibuja. Por eso vive en
 * `components/` y no dentro de un módulo.
 */
export function Tarjeta({
  titulo,
  descripcion,
  accion,
  tono = 'claro',
  sinRelleno = false,
  className = '',
  children,
  ...resto
}: Props) {
  const tieneEncabezado = Boolean(titulo || descripcion || accion)

  return (
    <div
      className={`rounded-tarjeta border shadow-tarjeta ${MARCO[tono]} ${sinRelleno ? '' : 'p-5'} ${className}`}
      {...resto}
    >
      {tieneEncabezado && (
        <div className={`flex items-start justify-between gap-3 ${sinRelleno ? 'p-5 pb-0' : ''} ${children ? 'mb-4' : ''}`}>
          <div className="min-w-0">
            {titulo && <h2 className={`text-base font-semibold tracking-tight ${TITULO[tono]}`}>{titulo}</h2>}
            {descripcion && <p className={`mt-1 text-sm ${DESCRIPCION[tono]}`}>{descripcion}</p>}
          </div>
          {accion && <div className="shrink-0">{accion}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
