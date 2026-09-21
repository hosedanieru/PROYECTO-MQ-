import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  error?: string
  /** Lo entrega `register()` de react-hook-form. */
  ref?: Ref<HTMLInputElement>
}

/**
 * Campo de texto con etiqueta y mensaje de error. React 19 pasa `ref`
 * como prop normal, así que `register()` funciona sin `forwardRef`.
 */
export function Campo({ etiqueta, error, id, className = '', ...resto }: Props) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado

  return (
    <div className="space-y-1">
      <label htmlFor={idCampo} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
        className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-marca ${
          error ? 'border-red-500' : 'border-slate-300'
        } ${className}`}
        {...resto}
      />
      {error && (
        <p id={`${idCampo}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
