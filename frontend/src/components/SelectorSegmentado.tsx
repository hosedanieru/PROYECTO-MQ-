interface Opcion<T extends string> {
  valor: T
  texto: string
  /** Cuántos registros hay en esa opción; se omite si no se conoce. */
  contador?: number
}

interface Props<T extends string> {
  opciones: Opcion<T>[]
  activo: T
  cambiar: (valor: T) => void
  /** Nombre para lectores de pantalla ("Tipo de ítem"). */
  etiqueta: string
}

/**
 * Botones pegados para elegir UNA opción (Todo · Insumos · PI · PT).
 * Reemplaza a las pestañas hechas a mano en cada pantalla. Botones
 * grandes: se tocan bien con el dedo en la tablet de piso.
 */
export function SelectorSegmentado<T extends string>({ opciones, activo, cambiar, etiqueta }: Props<T>) {
  return (
    <div role="group" aria-label={etiqueta} className="inline-flex flex-wrap gap-1 rounded-2xl bg-velo p-1">
      {opciones.map((o) => {
        const elegido = o.valor === activo
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={elegido}
            onClick={() => cambiar(o.valor)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition pointer-coarse:min-h-11 ${
              elegido ? 'bg-base text-tinta shadow-tarjeta' : 'text-tinta-suave hover:text-tinta'
            }`}
          >
            {o.texto}
            {o.contador !== undefined && (
              <span
                className={`cifra rounded-full px-2 py-0.5 text-xs ${elegido ? 'bg-marca-relleno text-white' : 'bg-base/70 text-tinta-suave'}`}
              >
                {o.contador}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
