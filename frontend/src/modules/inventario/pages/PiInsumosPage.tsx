/**
 * PI E INSUMOS — catálogo
 * =======================
 *
 * Alta y edición de lo que se consume para armar el PT: PI (lo que llega
 * de PepsiCo para reempaque) e insumos (cajas, cintas, bolsas…). El PT no
 * se crea aquí: nace con su producto en la pestaña Productos (PT).
 *
 * El tipo no se cambia después de crear (el kardex depende de él). Sin
 * eliminar: se desactiva.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_TIPO_ITEM, TIPOS_ITEM_ENTRADA, type ItemInventario, type TipoItem } from '../../../shared/types/inventario'
import { cantidad } from '../../../shared/utils/numeros'
import { useActualizarItem, useCrearItem, useItemsInventario } from '../hooks/useInventario'
import { TONO_TIPO } from '../tonos'

interface Form {
  tipo: TipoItem
  codigo: string
  descripcion: string
  unidadMedida: string
}

const VACIO: Form = { tipo: 'INSUMO', codigo: '', descripcion: '', unidadMedida: 'UNIDAD' }

export function PiInsumosPage() {
  const items = useItemsInventario()
  const crear = useCrearItem()
  const actualizar = useActualizarItem()
  const [editando, setEditando] = useState<ItemInventario | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)

  const lista = items.data?.filter((i) => i.tipo !== 'PT') ?? []

  const abrir = (i: ItemInventario | 'nuevo') => {
    setForm(i === 'nuevo' ? VACIO : { tipo: i.tipo, codigo: i.codigo, descripcion: i.descripcion, unidadMedida: i.unidadMedida })
    crear.reset()
    actualizar.reset()
    setEditando(i)
  }

  const guardar = () => {
    const datos = { codigo: form.codigo.trim(), descripcion: form.descripcion.trim(), unidadMedida: form.unidadMedida }
    const cerrar = { onSuccess: () => setEditando(null) }
    if (editando === 'nuevo') crear.mutate({ tipo: form.tipo, ...datos }, cerrar)
    else if (editando) actualizar.mutate({ id: editando.id, cambios: datos }, cerrar)
  }
  const mutacion = editando === 'nuevo' ? crear : actualizar
  const completo = form.codigo.trim() !== '' && form.descripcion.trim() !== '' && form.unidadMedida.trim() !== ''

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">PI (lo que llega para reempaque) e insumos (cajas, cintas, bolsas…). El PT se crea desde Productos.</p>
        <Boton onClick={() => abrir('nuevo')}>Nuevo PI o insumo</Boton>
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
            {lista.map((i) => (
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
            {items.data && lista.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-tinta-suave">Todavía no hay PI ni insumos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo PI o insumo' : 'Editar'} onCerrar={() => setEditando(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (completo) guardar() }}>
          <Select etiqueta="Tipo" value={form.tipo} disabled={editando !== 'nuevo'} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoItem })}>
            {TIPOS_ITEM_ENTRADA.map((t) => <option key={t} value={t}>{NOMBRE_TIPO_ITEM[t]}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="CAJA-12X" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo etiqueta="Unidad de medida" placeholder="UNIDAD, ROLLO, KG…" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })} />
            <div className="col-span-2">
              <Campo etiqueta="Descripción" placeholder="Caja corrugada 12X" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
          </div>
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
