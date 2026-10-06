/**
 * Círculo con las iniciales de una persona (máximo dos letras). Ayuda a
 * encontrar a alguien de un vistazo en una lista larga, sin fotos.
 */
export function Iniciales({ nombre, activo = true }: { nombre: string; activo?: boolean }) {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      aria-hidden="true"
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black ${
        // --marca-relleno: el único azul donde el blanco da 6,7:1 en los dos temas (regla de legibilidad).
        activo ? 'bg-marca-relleno text-white' : 'bg-velo text-tinta-suave'
      }`}
    >
      {letras || '?'}
    </span>
  )
}
