import { Boton } from './Boton'
import { miles } from '../shared/utils/numeros'

interface Props {
  pagina: number
  porPagina: number
  total: number
  /** Nombre en plural de lo que se cuenta: "remisiones". */
  unidad: string
  cambiar: (pagina: number) => void
}

/** "Mostrando 21–40 de 132 remisiones · ‹ Anterior · Página 2 de 7 · Siguiente ›" */
export function Paginacion({ pagina, porPagina, total, unidad, cambiar }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1
  const hasta = Math.min(total, pagina * porPagina)

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 text-sm text-tinta-suave">
      <span>
        Mostrando <strong className="cifra text-tinta">{miles(desde)}–{miles(hasta)}</strong> de{' '}
        <strong className="cifra text-tinta">{miles(total)}</strong> {unidad}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <Boton variante="secundario" tamano="sm" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>
            ‹ Anterior
          </Boton>
          <span className="cifra px-1">
            {pagina} / {totalPaginas}
          </span>
          <Boton
            variante="secundario"
            tamano="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => cambiar(pagina + 1)}
          >
            Siguiente ›
          </Boton>
        </div>
      )}
    </footer>
  )
}
