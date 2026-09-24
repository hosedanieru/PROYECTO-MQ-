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
      <label htmlFor={idCampo} className="block text-sm font-medium text-tinta-suave">
        {etiqueta}
      </label>
      <textarea
        id={idCampo}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-lg border bg-base px-3 py-2 text-sm text-tinta shadow-sm transition outline-none placeholder:text-tinta-suave/60 focus:border-marca focus:ring-2 focus:ring-marca/30 ${
          error ? 'border-critico' : 'border-borde'
        } ${className}`}
        {...resto}
      />
      {error && <p className="text-sm text-critico">{error}</p>}
    </div>
  )
}
