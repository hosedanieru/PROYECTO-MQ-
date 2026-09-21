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
      <label htmlFor={idCampo} className="block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <select
        id={idCampo}
        aria-invalid={error ? true : undefined}
        className={`block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-marca ${
          error ? 'border-red-500' : 'border-slate-300'
        } ${className}`}
        {...resto}
      >
        {children}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
