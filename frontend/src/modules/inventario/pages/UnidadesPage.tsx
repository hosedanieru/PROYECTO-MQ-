/**
 * UNIDADES DE MEDIDA
 * ==================
 *
 * La lista desplegable de "unidad base" de PI e insumos (UNIDAD, ROLLO,
 * PAQUETE…). Caja y estiba no van aquí: son presentaciones con su
 * equivalencia en cada PI o insumo. Sin eliminar: se desactiva.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { UnidadMedida } from '../../../shared/types/inventario'
import { useGuardarUnidad, useUnidades } from '../hooks/useInventario'

export function UnidadesPage() {
  const unidades = useUnidades()
  const guardar = useGuardarUnidad()
  const [editando, setEditando] = useState<UnidadMedida | 'nueva' | null>(null)
  const [form, setForm] = useState({ codigo: '', nombre: '' })

  const abrir = (u: UnidadMedida | 'nueva') => {
    setForm(u === 'nueva' ? { codigo: '', nombre: '' } : { codigo: u.codigo, nombre: u.nombre })
    guardar.reset()
    setEditando(u)
  }
  const enviar = () =>
    guardar.mutate(
      { id: editando === 'nueva' ? undefined : (editando as UnidadMedida).id, datos: { codigo: form.codigo.trim(), nombre: form.nombre.trim() } },
      { onSuccess: () => setEditando(null) },
    )

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">
          Unidades en que se cuentan los PI y los insumos (la lista desplegable). Caja y estiba se definen como equivalencias en cada uno.
        </p>
        <Boton onClick={() => abrir('nueva')}>Nueva unidad</Boton>
      </header>

      {guardar.isError && editando === null && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr><th className="px-4 py-2">Código</th><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Estado</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {unidades.data?.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2 cifra">{u.codigo}</td>
                <td className="px-4 py-2">{u.nombre}</td>
                <td className="px-4 py-2">{u.activo ? 'Activa' : 'Inactiva'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => abrir(u)}>Editar</button>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => guardar.mutate({ id: u.id, datos: { activo: !u.activo } })}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nueva' ? 'Nueva unidad de medida' : 'Editar unidad'} onCerrar={() => setEditando(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (form.codigo.trim() && form.nombre.trim()) enviar() }}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="ROLLO" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo etiqueta="Nombre" placeholder="Rollo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={!form.codigo.trim() || !form.nombre.trim()}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
