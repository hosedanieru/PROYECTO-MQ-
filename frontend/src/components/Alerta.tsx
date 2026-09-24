import type { ReactNode } from 'react'

type Tipo = 'error' | 'exito' | 'info' | 'advertencia'

const ESTILOS: Record<Tipo, string> = {
  error: 'border-critico/30 bg-critico-claro text-critico',
  exito: 'border-exito/30 bg-exito-claro text-exito',
  info: 'border-marca/30 bg-marca-claro text-marca-texto',
  advertencia: 'border-alerta/30 bg-alerta-claro text-alerta',
}

export function Alerta({ tipo, children }: { tipo: Tipo; children: ReactNode }) {
  return (
    <div role="alert" className={`rounded-lg border px-3 py-2 text-sm font-medium ${ESTILOS[tipo]}`}>
      {children}
    </div>
  )
}
