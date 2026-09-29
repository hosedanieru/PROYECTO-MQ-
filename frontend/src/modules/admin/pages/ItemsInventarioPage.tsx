/**
 * ADMINISTRACIÓN DE ÍTEMS DE INVENTARIO
 * =====================================
 *
 * Alta y edición de insumos, PI y PT. El PT se enlaza a un producto del
 * catálogo de remisiones (opción A, 2026-09-29): no se escribe su código
 * ni su descripción. El tipo y el producto no se cambian después de
 * crear (el kardex depende de ellos). Sin eliminar: se desactiva.
 */

import { useMemo, useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_TIPO_ITEM, TIPOS_ITEM, type ItemInventario, type TipoItem } from '../../../shared/types/inventario'
import { cantidad } from '../../../shared/utils/numeros'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { useActualizarItem, useCrearItem, useItemsInventario } from '../../inventario/hooks/useInventario'
import { TONO_TIPO } from '../../inventario/tonos'

interface Form {
  tipo: TipoItem
  codigo: string
  descripcion: string
  unidadMedida: string
  productoId: string
}

const VACIO: Form = { tipo: 'INSUMO', codigo: '', descripcion: '', unidadMedida: 'UNIDAD', productoId: '' }

export function ItemsInventarioPage() {
  const items = useItemsInventario()
  const productos = useProductos({ soloActivos: true })
  const crear = useCrearItem()
  const actualizar = useActualizarItem()
  const [editando, setEditando] = useState<ItemInventario | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)

  // Productos que todavía no tienen su ítem de PT.
  const productosLibres = useMemo(() => {
    const conItem = new Set(items.data?.map((i) => i.productoId).filter(Boolean))
    return productos.data?.filter((p) => !conItem.has(p.id)) ?? []
  }, [items.data, productos.data])

  const abrir = (i: ItemInventario | 'nuevo') => {
    setForm(i === 'nuevo' ? VACIO : { tipo: i.tipo, codigo: i.codigo, descripcion: i.descripcion, unidadMedida: i.unidadMedida, productoId: i.productoId ?? '' })
    crear.reset()
    actualizar.reset()
    setEditando(i)
  }

  const esPt = form.tipo === 'PT'
  const guardar = () => {
    const cerrar = { onSuccess: () => setEditando(null) }
    if (editando === 'nuevo') {
      crear.mutate(
        esPt
          ? { tipo: 'PT', productoId: form.productoId, unidadMedida: form.unidadMedida }
          : { tipo: form.tipo, codigo: form.codigo.trim(), descripcion: form.descripcion.trim(), unidadMedida: form.unidadMedida },
        cerrar,
      )
    } else if (editando) {
      actualizar.mutate(
        {
          id: editando.id,
          cambios: esPt
            ? { unidadMedida: form.unidadMedida }
            : { codigo: form.codigo.trim(), descripcion: form.descripcion.trim(), unidadMedida: form.unidadMedida },
        },
        cerrar,
      )
    }
  }
  const mutacion = editando === 'nuevo' ? crear : actualizar
  const completo = form.unidadMedida.trim() !== '' && (esPt ? form.productoId !== '' : form.codigo.trim() !== '' && form.descripcion.trim() !== '')

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Ítems de inventario</h1>
          <p className="text-sm text-tinta-suave">Insumos, PI y PT. El PT se enlaza al producto del catálogo de remisiones.</p>
        </div>
        <Boton onClick={() => abrir('nuevo')}>Nuevo ítem</Boton>
      </header>

      {actualizar.isError && editando === null && <Alerta tipo="error">{comoErrorApi(actualizar.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Código</th><th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Unidad</th><th className="px-4 py-2 text-right">Existencia</th><th className="px-4 py-2">Estado</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {items.data?.map((i) => (
              <tr key={i.id} className={i.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2"><Badge tono={TONO_TIPO[i.tipo]}>{i.tipo}</Badge></td>
                <td className="px-4 py-2 cifra">{i.codigo}</td>
                <td className="px-4 py-2">{i.descripcion}</td>
                <td className="px-4 py-2">{i.unidadMedida}</td>
                <td className="px-4 py-2 text-right cifra">{cantidad(i.existencia)}</td>
                <td className="px-4 py-2">{i.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => abrir(i)}>Editar</button>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => actualizar.mutate({ id: i.id, cambios: { activo: !i.activo } })}>
                    {i.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {items.data?.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-center text-tinta-suave">Sin ítems todavía.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo ítem de inventario' : 'Editar ítem'} onCerrar={() => setEditando(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (completo) guardar() }}>
          <Select
            etiqueta="Tipo"
            value={form.tipo}
            disabled={editando !== 'nuevo'}
            onChange={(e) => {
              const tipo = e.target.value as TipoItem
              setForm({ ...form, tipo, unidadMedida: tipo === 'PT' ? 'CAJA' : form.unidadMedida })
            }}
          >
            {TIPOS_ITEM.map((t) => <option key={t} value={t}>{NOMBRE_TIPO_ITEM[t]}</option>)}
          </Select>

          {esPt ? (
            editando === 'nuevo' ? (
              <Select etiqueta="Producto (catálogo de remisiones)" value={form.productoId} onChange={(e) => setForm({ ...form, productoId: e.target.value })}>
                <option value="">— Seleccione el producto —</option>
                {productosLibres.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion}</option>)}
              </Select>
            ) : (
              <p className="rounded-lg bg-velo px-3 py-2 text-sm">
                <span className="cifra">{form.codigo}</span> · {form.descripcion}
                <span className="block text-xs text-tinta-suave">El código y la descripción del PT se cambian en Administración → Productos.</span>
              </p>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Código" placeholder="CAJA-12X" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
              <Campo etiqueta="Unidad de medida" placeholder="UNIDAD, ROLLO, KG…" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} />
              <div className="col-span-2">
                <Campo etiqueta="Descripción" placeholder="Caja corrugada 12X" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            </div>
          )}
          {esPt && <Campo etiqueta="Unidad de medida" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} />}

          {mutacion.isError && <Alerta tipo="error">{comoErrorApi(mutacion.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={mutacion.isPending} disabled={!completo}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
