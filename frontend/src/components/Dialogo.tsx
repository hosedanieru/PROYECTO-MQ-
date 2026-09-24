import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/**
 * Diálogo modal sobre el elemento nativo `<dialog>`: trae foco atrapado,
 * cierre con Escape y fondo oscurecido sin librerías.
 */
export function Dialogo({ abierto, titulo, onCerrar, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      className="w-full max-w-md rounded-xl p-0 shadow-xl backdrop:bg-black/40 open:fixed open:top-1/2 open:left-1/2 open:-translate-x-1/2 open:-translate-y-1/2"
    >
      <div className="space-y-4 p-6">
        <h2 className="text-lg font-semibold text-tinta">{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}
