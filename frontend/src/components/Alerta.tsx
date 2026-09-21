import type { ReactNode } from 'react'

type Tipo = 'error' | 'exito' | 'info'

const ESTILOS: Record<Tipo, string> = {
  error: 'border-red-300 bg-red-50 text-red-800',
  exito: 'border-green-300 bg-green-50 text-green-800',
  info: 'border-blue-300 bg-blue-50 text-blue-800',
}

export function Alerta({ tipo, children }: { tipo: Tipo; children: ReactNode }) {
  return (
    <div role="alert" className={`rounded-md border px-3 py-2 text-sm ${ESTILOS[tipo]}`}>
      {children}
    </div>
  )
}
