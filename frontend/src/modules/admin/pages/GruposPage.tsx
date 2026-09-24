/**
 * ADMINISTRACIÓN DE GRUPOS (antes "proveedores")
 * ==============================================
 *
 * Quien pone el personal del turno. El proveedor real se escribe en la
 * descripción (texto libre). "Personas esperadas" es lo que el grupo
 * debería enviar por turno: se compara con la asistencia registrada en
 * la programación del día. Sin eliminar: se desactiva.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { Grupo } from '../../../shared/types/catalogo'
import { catalogoApi } from '../../catalogo/api/catalogo.api'
import { useGrupos } from '../../catalogo/hooks/useCatalogos'

interface Form {
  codigo: string
  nombre: string
  descripcion: string
  personasEsperadas: string
}

const VACIO: Form = { codigo: '', nombre: '', descripcion: '', personasEsperadas: '' }

export function GruposPage() {
  const qc = useQueryClient()
  const grupos = useGrupos()
  const [editando, setEditando] = useState<Grupo | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['catalogo', 'grupos'] })

  const abrir = (g: Grupo | 'nuevo') => {
    setForm(g === 'nuevo' ? VACIO : { codigo: g.codigo, nombre: g.nombre, descripcion: g.descripcion ?? '', personasEsperadas: g.personasEsperadas?.toString() ?? '' })
    setEditando(g)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        personasEsperadas: form.personasEsperadas.trim() === '' ? null : Number(form.personasEsperadas),
      }
      return editando === 'nuevo' ? catalogoApi.crearGrupo(datos) : catalogoApi.actualizarGrupo((editando as Grupo).id, datos)
    },
    onSuccess: () => { invalidar(); setEditando(null) },
  })
  const cambiarActivo = useMutation({
    mutationFn: (g: Grupo) => catalogoApi.actualizarGrupo(g.id, { activo: !g.activo }),
    onSuccess: invalidar,
  })

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-tinta">Grupos</h1>
          <p className="text-sm text-tinta-suave">Quien pone el personal del turno. El proveedor se escribe en la descripción.</p>
        </div>
        <Boton onClick={() => abrir('nuevo')}>Nuevo grupo</Boton>
      </header>

      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2">Código</th><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Descripción (proveedor)</th>
              <th className="px-4 py-2 text-right" title="Personas que debería enviar por turno">Pers. esperadas</th><th className="px-4 py-2">Estado</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {grupos.data?.map((g) => (
              <tr key={g.id} className={g.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2 cifra">{g.codigo}</td>
                <td className="px-4 py-2 font-medium">{g.nombre}</td>
                <td className="px-4 py-2 max-w-md truncate" title={g.descripcion ?? ''}>{g.descripcion ?? <span className="text-alerta">sin proveedor</span>}</td>
                <td className="px-4 py-2 text-right">{g.personasEsperadas ?? <span className="text-alerta">—</span>}</td>
                <td className="px-4 py-2">{g.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => abrir(g)}>Editar</button>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => cambiarActivo.mutate(g)}>{g.activo ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
            {grupos.data?.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-tinta-suave">Sin grupos.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nuevo' ? 'Nuevo grupo' : `Editar grupo ${(editando as Grupo | null)?.codigo ?? ''}`} onCerrar={() => setEditando(null)}>
        <form onSubmit={(e) => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="LOGICMARD" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo etiqueta="Nombre" placeholder="Grupo 1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <AreaTexto etiqueta="Descripción (proveedor, contacto…)" rows={3} placeholder="Ej.: Proveedor Logicmard S.A.S. — contacto Juan Pérez" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <Campo etiqueta="Personas esperadas por turno" type="number" min={1} value={form.personasEsperadas} onChange={(e) => setForm({ ...form, personasEsperadas: e.target.value })} />
          <p className="text-xs text-tinta-suave">Se compara con las personas que realmente llegaron al turno: si llegan menos, la productividad del turno se marca como afectada.</p>
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
