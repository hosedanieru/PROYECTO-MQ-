export function PantallaCargando({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      {mensaje}
    </div>
  )
}
