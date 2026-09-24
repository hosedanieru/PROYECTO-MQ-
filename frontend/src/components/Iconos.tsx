import type { SVGProps } from 'react'

/**
 * ÍCONOS
 * ======
 *
 * Trazos SVG propios en lugar de una librería de íconos. Son pocos y
 * pesan menos que una dependencia; si algún día hacen falta cincuenta,
 * ahí sí se evalúa traer una.
 *
 * Todos comparten rejilla de 24, trazo de 1,7 y `currentColor`: heredan
 * el color del texto, así que el mismo ícono sirve en la barra oscura y
 * en fondo blanco sin duplicarlo.
 */
type Props = SVGProps<SVGSVGElement>

function Base({ children, ...resto }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      {...resto}
    >
      {children}
    </svg>
  )
}

export function IconoInicio(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </Base>
  )
}

export function IconoRemision(props: Props) {
  return (
    <Base {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </Base>
  )
}

export function IconoTablero(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Base>
  )
}

export function IconoCalendario(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Base>
  )
}

export function IconoCaja(props: Props) {
  return (
    <Base {...props}>
      <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5z" />
      <path d="m3 8.5 9 5.5 9-5.5M12 14v7" />
    </Base>
  )
}

export function IconoLinea(props: Props) {
  return (
    <Base {...props}>
      <rect x="2" y="14" width="20" height="7" rx="1.5" />
      <path d="M6 14V8l4 2V8l4 2V6l4 2v6" />
    </Base>
  )
}

export function IconoPersonas(props: Props) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 5M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </Base>
  )
}

export function IconoUsuario(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Base>
  )
}

export function IconoBalanza(props: Props) {
  return (
    <Base {...props}>
      <path d="M12 4v16M8 20h8M12 7l7 2M12 7 5 9" />
      <path d="M5 9 2.5 15h5zM19 9l-2.5 6h5z" />
    </Base>
  )
}

export function IconoMenu(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Base>
  )
}

export function IconoCerrar(props: Props) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  )
}

export function IconoSalir(props: Props) {
  return (
    <Base {...props}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 8 6 12l4 4M6 12h9" />
    </Base>
  )
}

export function IconoReloj(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </Base>
  )
}

export function IconoChevron(props: Props) {
  return (
    <Base {...props}>
      <path d="m9 5 7 7-7 7" />
    </Base>
  )
}

export function IconoSol(props: Props) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </Base>
  )
}

export function IconoLuna(props: Props) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </Base>
  )
}

export function IconoPlanta(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 21V9l5 3V9l5 3V7l6 3v11z" />
      <path d="M2 21h20" />
    </Base>
  )
}
