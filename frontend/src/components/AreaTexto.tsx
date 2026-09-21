import { useId, type Ref, type TextareaHTMLAttributes } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string
  error?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function AreaTexto({ etiqueta, error, id, className = '', ...resto }: Props) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado

  return (
    <div className="space-y-1">
      <label htmlFor={idCampo} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <textarea
        id={idCampo}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-marca ${
          error ? 'border-red-500' : 'border-slate-300'
        } ${className}`}
        {...resto}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
