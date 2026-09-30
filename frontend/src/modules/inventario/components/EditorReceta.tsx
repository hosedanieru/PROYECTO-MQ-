/**
 * EDITOR DE RECETA
 * ================
 *
 * Lista de PI e insumos de un PT con lo que gasta UNA caja, en la medida
 * exacta de cada componente y con decimales ("1,8 METRO por caja",
 * "12 UNIDAD por caja"; usuario, 2026-09-29). Controlado: el estado vive
 * en quien lo usa (formulario de PT nuevo o diálogo Receta).
 *
 * Solo se pueden agregar PI e insumos que existan y estén activos. Uno
 * que ya estaba en la receta y se desactivó se sigue mostrando, marcado.
 */

import { useMemo, useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { MAXIMO_COMPONENTES_RECETA, type ComponenteReceta } from '../../../shared/types/inventario'
import { useItemsInventario } from '../hooks/useInventario'
import { cantidadValida, leerCantidad, textoEquivalenciaReceta } from '../receta'
import { TONO_TIPO } from '../tonos'

interface Props {
  componentes: ComponenteReceta[]
  onCambiar: (componentes: ComponenteReceta[]) => void
}

export function EditorReceta({ componentes, onCambiar }: Props) {
  // Todos (también inactivos) para poder nombrar lo que ya está en la receta.
  const items = useItemsInventario()
  const porId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data])

  const [busqueda, setBusqueda] = useState('')
  const [itemId, setItemId] = useState('')
  const [cantidad, setCantidad] = useState('')

  const elegibles = useMemo(() => {
    const usados = new Set(componentes.map((c) => c.itemId))
    const t = busqueda.trim().toLowerCase()
    return (items.data ?? []).filter(
      (i) =>
        i.tipo !== 'PT' &&
        i.activo &&
        !usados.has(i.id) &&
        (!t || i.codigo.toLowerCase().includes(t) || i.descripcion.toLowerCase().includes(t)),
    )
  }, [items.data, componentes, busqueda])

  const elegido = porId.get(itemId)
  const nueva = leerCantidad(cantidad)
  const nuevaValida = Boolean(elegido) && cantidadValida(nueva)
  const lleno = componentes.length >= MAXIMO_COMPONENTES_RECETA

  const agregar = () => {
    if (!nuevaValida || lleno) return
    onCambiar([...componentes, { itemId, cantidad: nueva }])
    setItemId('')
    setCantidad('')
    setBusqueda('')
  }

  const cambiar = (i: number, valor: string) =>
    onCambiar(componentes.map((c, j) => (j === i ? { ...c, cantidad: leerCantidad(valor) } : c)))

  const hayMateriales = (items.data ?? []).some((i) => i.tipo !== 'PT' && i.activo)

  return (
    <div className="space-y-3">
      {items.data && !hayMateriales && (
        <Alerta tipo="advertencia">Todavía no hay PI ni insumos activos. Créelos primero en las pestañas PI e Insumos.</Alerta>
      )}

      <ul className="divide-y divide-borde rounded-lg border border-borde">
        {componentes.map((c, i) => {
          const item = porId.get(c.itemId)
          return (
            <li key={c.itemId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              {item && <Badge tono={TONO_TIPO[item.tipo]}>{item.tipo}</Badge>}
              <span className="min-w-0 flex-1">
                <span className="cifra">{item?.codigo ?? '—'}</span> <span className="text-tinta-suave">{item?.descripcion ?? 'Ítem no encontrado'}</span>
                {item && !item.activo && <span className="ml-1 text-xs text-critico">(inactivo)</span>}
              </span>
              <input
                aria-label="Cantidad por caja"
                className={`w-24 rounded border bg-base px-2 py-1 text-right ${cantidadValida(c.cantidad) ? 'border-borde' : 'border-critico'}`}
                type="number" inputMode="decimal" min={0.001} step="any"
                value={Number.isNaN(c.cantidad) ? '' : c.cantidad}
                onChange={(e) => cambiar(i, e.target.value)}
              />
              <span className="text-tinta-suave">{item?.unidadMedida ?? ''} por caja</span>
              <button type="button" className="text-critico hover:underline" onClick={() => onCambiar(componentes.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </li>
          )
        })}
        {componentes.length === 0 && <li className="px-3 py-3 text-sm text-tinta-suave">Sin componentes. La receta necesita al menos un PI o insumo.</li>}
      </ul>

      <div className="grid gap-2 rounded-lg bg-velo p-3 sm:grid-cols-[1fr_1fr_10rem]">
        <Campo etiqueta="Buscar PI o insumo" placeholder="Código o descripción" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Select etiqueta="Componente" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">— Seleccione —</option>
          {elegibles.map((i) => <option key={i.id} value={i.id}>{i.tipo} · {i.codigo} · {i.descripcion}</option>)}
        </Select>
        <Campo
          etiqueta={`Por caja${elegido ? ` (${elegido.unidadMedida})` : ''}`}
          type="number" inputMode="decimal" min={0.001} step="any" placeholder="Ej.: 1,8"
          value={cantidad} onChange={(e) => setCantidad(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2 sm:col-span-3">
          <p className="text-xs text-tinta-suave">
            {nuevaValida && elegido
              ? `Se agregará: ${textoEquivalenciaReceta(nueva, elegido.unidadMedida)}.`
              : 'Lo que gasta UNA caja, en la medida del componente (hasta 3 decimales). Ej.: 1,8 metros de cinta; 12 bolsas.'}
          </p>
          <Boton type="button" variante="secundario" onClick={agregar} disabled={!nuevaValida || lleno}>+ Agregar</Boton>
        </div>
      </div>
    </div>
  )
}
