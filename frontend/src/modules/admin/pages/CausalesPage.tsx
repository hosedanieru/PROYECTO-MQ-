/**
 * ADMINISTRACIÓN DE CAUSALES DE AVERÍA
 * ====================================
 *
 * La lista desplegable del formulario de averías. Viene de la base de
 * datos (usuario, 2026-09-28) para que el área agregue causales sin
 * tocar el sistema. `orden` es la posición en la lista. Sin eliminar:
 * se desactiva (deja de salir en el formulario, pero los reportes viejos
 * la siguen mostrando).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { CausalAveria } from '../../../shared/types/averia'
import { averiasApi } from '../../averias/api/averias.api'
import { useCausales } from '../../averias/hooks/useAverias'

interface Form {
  codigo: string
  nombre: string
  orden: string
}

export function CausalesPage() {
  const qc = useQueryClient()
  const causales = useCausales()
  const [editando, setEditando] = useState<CausalAveria | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>({ codigo: '', nombre: '', orden: '' })
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['averias', 'causales'] })

  const abrir = (c: CausalAveria | 'nuevo') => {
    const siguienteOrden = Math.max(0, ...(causales.data ?? []).map((x) => x.orden)) + 1
    setForm(c === 'nuevo' ? { codigo: '', nombre: '', orden: String(siguienteOrden) } : { codigo: c.codigo, nombre: c.nombre, orden: String(c.orden) })
    setEditando(c)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const datos = { codigo: form.codigo.trim(), nombre: form.nombre.trim(), orden: Number(form.orden) }
      return editando === 'nuevo' ? averiasApi.crearCausal(datos) : averiasApi.actualizarCausal((editando as CausalAveria).id, datos)
    },
    onSuccess: () => { invalidar(); setEditando(null) },
  })
  const cambiarActivo = useMutation({
    mutationFn: (c: CausalAveria) => averiasApi.actualizarCausal(c.id, { activo: !c.activo }),
    onSuccess: invalidar,
  })

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Causales de avería</h1>
          <p className="text-sm text-tinta-suave">La lista desplegable del reporte de averías, en este orden.</p>
        </div>
        <Boton onClick={() => abrir('nuevo')}>Nueva causal</Boton>
      </header>

      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2 text-right">Orden</th><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Código</th><th className="px-4 py-2">Estado</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {causales.data?.map((c) => (
              <tr key={c.id} className={c.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2 text-right cifra">{c.orden}</td>
                <td className="px-4 py-2 font-medium">{c.nombre}</td>
                <td className="px-4 py-2 cifra text-xs">{c.codigo}</td>
                <td className="px-4 py-2">{c.activo ? 'Activa' : 'Inactiva'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => abrir(c)}>Editar</button>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => cambiarActivo.mutate(c)}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
            {causales.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-tinta-suave">Sin causales.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nueva causal' : 'Editar causal'} onCerrar={() => setEditando(null)}>
        <form onSubmit={(e) => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
          <Campo etiqueta="Nombre (como sale en la lista)" placeholder="Bolsa - rota" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="BOLSA_ROTA" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo etiqueta="Orden en la lista" type="number" min={0} value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
          </div>
          <p className="text-xs text-tinta-suave">El código identifica la causal (letras, números y guion bajo). El nombre es lo que ve quien reporta.</p>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={!form.codigo.trim() || !form.nombre.trim() || form.orden === ''}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
