import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string
  error?: string
  ref?: Ref<HTMLSelectElement>
  children: ReactNode
}

export function Select({ etiqueta, error, id, className = '', children, ...resto }: Props) {
  const idGenerado = useId()
  const idCampo = id ?? idGenerado

  return (
    <div className="space-y-1">
      <label htmlFor={idCampo} className="block text-sm font-medium text-tinta-suave">
        {etiqueta}
      </label>
      <select
        id={idCampo}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-lg border bg-base px-3 py-2 text-sm text-tinta shadow-sm transition outline-none focus:border-marca focus:ring-2 focus:ring-marca/30 ${
          error ? 'border-critico' : 'border-borde'
        } ${className}`}
        {...resto}
      >
        {children}
      </select>
      {error && <p className="text-sm text-critico">{error}</p>}
    </div>
  )
}
