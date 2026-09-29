/**
 * INVENTARIO — EXISTENCIAS
 * ========================
 *
 * Cuánto hay de insumos, PI y PT (usuario, 2026-09-29). Filtro por tipo
 * y búsqueda en la URL. Desde cada ítem: registrar un movimiento o ver
 * su kardex.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { TIPOS_ITEM, type ItemInventario, type TipoItem } from '../../../shared/types/inventario'
import { cantidad } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { MovimientoDialogo } from '../components/MovimientoDialogo'
import { useItemsInventario } from '../hooks/useInventario'
import { TONO_TIPO } from '../tonos'

const PESTANAS: Array<{ tipo: TipoItem | ''; nombre: string }> = [
  { tipo: '', nombre: 'Todo' },
  { tipo: 'INSUMO', nombre: 'Insumos' },
  { tipo: 'PI', nombre: 'PI' },
  { tipo: 'PT', nombre: 'PT' },
]

export function InventarioPage() {
  const [params, setParams] = useSearchParams()
  const tipoParam = params.get('tipo')
  const tipo = TIPOS_ITEM.includes(tipoParam as TipoItem) ? (tipoParam as TipoItem) : undefined
  const texto = params.get('texto') ?? ''
  const items = useItemsInventario({ tipo, texto, soloActivos: true })
  const { tienePermiso } = useSesion()
  const [moviendo, setMoviendo] = useState<ItemInventario | null>(null)

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Inventario</h1>
          <p className="text-sm text-tinta-suave">Existencias de insumos, PI y PT. Cada movimiento queda en el kardex con quién, cuándo y por qué.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {tienePermiso('inventario.catalogo') && (
            <Link to="/admin/inventario" className="text-sm text-marca hover:underline">Administrar ítems →</Link>
          )}
          {tienePermiso('inventario.registrar') && (
            <Link to="/inventario/entradas/nueva" className="rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-marca-hover">
              + Entrada de mercancía
            </Link>
          )}
        </div>
      </header>

      <Tarjeta>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex gap-1 rounded-lg bg-velo p-1">
            {PESTANAS.map((p) => (
              <button
                key={p.nombre}
                onClick={() => cambiar('tipo', p.tipo)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${(tipo ?? '') === p.tipo ? 'bg-base text-tinta shadow-sm' : 'text-tinta-suave'}`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <div className="min-w-60 flex-1">
            <Campo etiqueta="Buscar" placeholder="Código o descripción" value={texto} onChange={(e) => cambiar('texto', e.target.value)} />
          </div>
        </div>
      </Tarjeta>

      {items.isError && <Alerta tipo="error">{comoErrorApi(items.error).mensaje}</Alerta>}

      <Tarjeta sinRelleno>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
              <tr>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2 text-right">Existencia</th>
                <th className="px-4 py-2">Unidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {items.data?.map((i) => (
                <tr key={i.id} className="hover:bg-velo/60">
                  <td className="px-4 py-2"><Badge tono={TONO_TIPO[i.tipo]}>{i.tipo}</Badge></td>
                  <td className="px-4 py-2 cifra">{i.codigo}</td>
                  <td className="px-4 py-2">{i.descripcion}</td>
                  <td className={`px-4 py-2 text-right cifra font-semibold ${i.existencia === 0 ? 'text-tinta-suave' : 'text-tinta'}`}>{cantidad(i.existencia)}</td>
                  <td className="px-4 py-2 text-tinta-suave">{i.unidadMedida}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {tienePermiso('inventario.registrar') && (
                      <Boton variante="sutil" tamano="sm" onClick={() => setMoviendo(i)}>Movimiento</Boton>
                    )}
                    <Link to={`/inventario/${i.id}`} className="ml-2 text-sm text-marca hover:underline">Kardex</Link>
                  </td>
                </tr>
              ))}
              {items.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-tinta-suave">
                    {texto || tipo ? 'Ningún ítem coincide con el filtro.' : 'Todavía no hay ítems de inventario. El administrador los crea en Administración → Ítems de inventario.'}
                  </td>
                </tr>
              )}
              {items.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-tinta-suave">Cargando…</td></tr>}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {moviendo && <MovimientoDialogo item={moviendo} onCerrar={() => setMoviendo(null)} />}
    </section>
  )
}
