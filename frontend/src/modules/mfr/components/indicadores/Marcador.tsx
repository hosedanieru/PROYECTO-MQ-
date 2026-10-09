/** Cifra grande de un indicador con su explicación debajo (sin caja). */
export function Marcador({ titulo, valor, detalle, color = 'text-tinta' }: { titulo: string; valor: string; detalle?: string; color?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{titulo}</p>
      <p className={`cifra mt-1 text-5xl font-black leading-none tracking-tight ${color}`}>{valor}</p>
      {detalle && <p className="mt-2 max-w-xs text-sm text-tinta-suave">{detalle}</p>}
    </div>
  )
}
