/**
 * CATÁLOGO DE PI O DE INSUMOS
 * ===========================
 *
 * Una pantalla para los dos (cada uno en su tabla y su pestaña): código,
 * descripción, unidad de MEDIDA (en qué se lleva y descuenta: METRO,
 * UNIDAD…), presentación con su contenido (ROLLO de 50 METRO) y escalones
 * estiba → caja → presentación (usuario, 2026-09-29). Crear uno crea su
 * existencia en el inventario. Sin eliminar: se desactiva.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Material, TipoMaterial } from '../../../shared/types/inventario'
import { textoEquivalencia } from '../equivalencias'
import { cantidadValida, leerCantidad } from '../receta'
import { useGuardarMaterial, useMateriales, useUnidades } from '../hooks/useInventario'

const TEXTO: Record<TipoMaterial, { nombre: string; ayuda: string; ejemplo: string }> = {
  PI: { nombre: 'PI', ayuda: 'Producto intermedio: lo que llega de PepsiCo para reempaque.', ejemplo: 'BOLSA PAPA 25 G' },
  INSUMO: { nombre: 'insumo', ayuda: 'Cajas, cintas, bolsas… lo que se consume para armar el PT.', ejemplo: 'CINTA 48 MM' },
}

interface Form {
  codigo: string
  descripcion: string
  unidadBaseId: string
  presentacionId: string
  contenidoPresentacion: string
  cajasPorEstiba: string
  unidadesPorCaja: string
}

const VACIO: Form = { codigo: '', descripcion: '', unidadBaseId: '', presentacionId: '', contenidoPresentacion: '', cajasPorEstiba: '', unidadesPorCaja: '' }
const entero = (v: string) => (v.trim() === '' ? null : Number(v))
const decimal = (v: string) => (v.trim() === '' ? null : leerCantidad(v))

export function MaterialesPage({ tipo }: { tipo: TipoMaterial }) {
  const materiales = useMateriales(tipo)
  const unidades = useUnidades()
  const guardar = useGuardarMaterial(tipo)
  const [editando, setEditando] = useState<Material | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)
  const t = TEXTO[tipo]

  const abrir = (m: Material | 'nuevo') => {
    const unidadPorDefecto = unidades.data?.find((u) => u.codigo === 'UNIDAD')?.id ?? ''
    setForm(
      m === 'nuevo'
        ? { ...VACIO, unidadBaseId: unidadPorDefecto }
        : {
            codigo: m.codigo,
            descripcion: m.descripcion,
            unidadBaseId: m.unidadBaseId,
            presentacionId: m.presentacionId ?? '',
            contenidoPresentacion: m.contenidoPresentacion?.toString() ?? '',
            cajasPorEstiba: m.cajasPorEstiba?.toString() ?? '',
            unidadesPorCaja: m.unidadesPorCaja?.toString() ?? '',
          },
    )
    guardar.reset()
    setEditando(m)
  }

  const enviar = () =>
    guardar.mutate(
      {
        id: editando === 'nuevo' ? undefined : (editando as Material).id,
        datos: {
          codigo: form.codigo.trim(),
          descripcion: form.descripcion.trim(),
          unidadBaseId: form.unidadBaseId,
          presentacionId: form.presentacionId || null,
          contenidoPresentacion: form.presentacionId ? decimal(form.contenidoPresentacion) : null,
          unidadesPorCaja: entero(form.unidadesPorCaja),
          cajasPorEstiba: entero(form.cajasPorEstiba),
        },
      },
      { onSuccess: () => setEditando(null) },
    )

  const unidadElegida = unidades.data?.find((u) => u.id === form.unidadBaseId)?.codigo ?? 'unidades'
  const presentacionElegida = unidades.data?.find((u) => u.id === form.presentacionId)?.codigo ?? null
  // La presentación va con su contenido (ej.: ROLLO con 50 metros).
  const presentacionCompleta = !form.presentacionId || cantidadValida(leerCantidad(form.contenidoPresentacion))
  const completo = form.codigo.trim() !== '' && form.descripcion.trim() !== '' && form.unidadBaseId !== '' && presentacionCompleta
  const opcionesUnidad = (actual: string) =>
    unidades.data?.filter((u) => u.activo || u.id === actual).map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.codigo})</option>)

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-suave">{t.ayuda} Crear uno crea su existencia en el inventario.</p>
        <Boton onClick={() => abrir('nuevo')}>Nuevo {t.nombre}</Boton>
      </header>

      {guardar.isError && editando === null && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2">Código</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2">Medida</th>
              <th className="px-4 py-2">Equivalencias</th><th className="px-4 py-2">Estado</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {materiales.data?.map((m) => (
              <tr key={m.id} className={m.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2 cifra">{m.codigo}</td>
                <td className="px-4 py-2">{m.descripcion}</td>
                <td className="px-4 py-2">{m.unidadBase}</td>
                <td className="px-4 py-2 text-tinta-suave">{textoEquivalencia(m)}</td>
                <td className="px-4 py-2">{m.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => abrir(m)}>Editar</button>
                  <button className="ml-3 text-tinta-suave hover:underline" onClick={() => guardar.mutate({ id: m.id, datos: { activo: !m.activo } })}>
                    {m.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {materiales.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-tinta-suave">Todavía no hay {tipo === 'PI' ? 'PI' : 'insumos'}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialogo abierto={editando !== null} titulo={editando === 'nuevo' ? `Nuevo ${t.nombre}` : `Editar ${t.nombre}`} onCerrar={() => setEditando(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (completo) enviar() }}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="Código SAP o propio" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Select etiqueta="Unidad de medida (en qué se lleva y se descuenta)" value={form.unidadBaseId} onChange={(e) => setForm({ ...form, unidadBaseId: e.target.value })}>
              <option value="">— Seleccione —</option>
              {opcionesUnidad(form.unidadBaseId)}
            </Select>
            <div className="col-span-2">
              <Campo etiqueta="Descripción" placeholder={t.ejemplo} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
          </div>

          <fieldset className="space-y-2 rounded-lg border border-borde p-3">
            <legend className="px-1 text-sm font-medium text-tinta-suave">Presentación (cómo viene y cuánto trae)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Select etiqueta="Presentación" value={form.presentacionId} onChange={(e) => setForm({ ...form, presentacionId: e.target.value })}>
                <option value="">Ninguna (se cuenta por {unidadElegida})</option>
                {opcionesUnidad(form.presentacionId)}
              </Select>
              <Campo
                etiqueta={`${unidadElegida} que trae${presentacionElegida ? ` 1 ${presentacionElegida}` : ''}`}
                type="number" inputMode="decimal" min={0.001} step="any" placeholder="Ej.: 50"
                disabled={!form.presentacionId}
                error={form.presentacionId && !presentacionCompleta ? 'Mayor que cero, hasta 3 decimales.' : undefined}
                value={form.contenidoPresentacion} onChange={(e) => setForm({ ...form, contenidoPresentacion: e.target.value })}
              />
            </div>
            <p className="text-xs text-tinta-suave">Ej.: cinta en METRO, presentación ROLLO con 50 metros. Así la receta del PT descuenta los metros exactos.</p>
          </fieldset>

          <fieldset className="space-y-2 rounded-lg border border-borde p-3">
            <legend className="px-1 text-sm font-medium text-tinta-suave">Empaque (estiba → caja → {presentacionElegida ?? unidadElegida})</legend>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Cajas por estiba" type="number" min={1} step={1} placeholder="Ej.: 40" value={form.cajasPorEstiba} onChange={(e) => setForm({ ...form, cajasPorEstiba: e.target.value })} />
              <Campo etiqueta={`${presentacionElegida ?? unidadElegida} por caja`} type="number" min={1} step={1} placeholder="Ej.: 36" value={form.unidadesPorCaja} onChange={(e) => setForm({ ...form, unidadesPorCaja: e.target.value })} />
            </div>
            <p className="text-xs text-tinta-suave">Déjelos vacíos si no se maneja ese empaque. Para usar estibas hay que definir también cuánto trae la caja.</p>
          </fieldset>

          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={!completo}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
