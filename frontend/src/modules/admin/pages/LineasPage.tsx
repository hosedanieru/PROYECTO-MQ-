/**
 * ADMINISTRACIÓN DE LÍNEAS DE PRODUCCIÓN
 * ======================================
 *
 * Las plataformas del DPP de PepsiCo: código, nombre (tal como lo
 * escribe PepsiCo, para cruzar al importar el PDF), tipo de máquina,
 * capacidad nominal en kg/h (fila "Capacity" del schedule) y orden.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { LineaProduccion, TipoLinea } from '../../../shared/types/mfr'
import { mfrApi } from '../../mfr/api/mfr.api'
import { useLineas } from '../../mfr/hooks/useMfr'

interface Form {
  codigo: string
  nombre: string
  tipo: TipoLinea
  capacidadKgHora: string
  orden: string
}

const VACIO: Form = { codigo: '', nombre: '', tipo: 'MANUAL', capacidadKgHora: '', orden: '0' }

export function LineasPage() {
  const qc = useQueryClient()
  const lineas = useLineas()
  const [nueva, setNueva] = useState<Form>(VACIO)
  const [edicion, setEdicion] = useState<Record<string, Form>>({})
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['mfr'] })

  const aDatos = (f: Form) => ({
    codigo: f.codigo,
    nombre: f.nombre,
    tipo: f.tipo,
    capacidadKgHora: f.capacidadKgHora ? Number(f.capacidadKgHora) : null,
    orden: Number(f.orden) || 0,
  })

  const crear = useMutation({
    mutationFn: () => mfrApi.crearLinea(aDatos(nueva)),
    onSuccess: () => { invalidar(); setNueva(VACIO) },
  })
  const actualizar = useMutation({
    mutationFn: (l: LineaProduccion) => mfrApi.actualizarLinea(l.id, aDatos(edicion[l.id])),
    onSuccess: (_, l) => { invalidar(); setEdicion((e) => { const { [l.id]: _q, ...r } = e; return r }) },
  })
  const cambiarActivo = useMutation({
    mutationFn: (l: LineaProduccion) => mfrApi.actualizarLinea(l.id, { activo: !l.activo }),
    onSuccess: invalidar,
  })

  const editor = (f: Form, cambiar: (c: Partial<Form>) => void) => (
    <>
      <td className="px-2 py-1"><Campo etiqueta="" placeholder="MANUAL-1" value={f.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" placeholder="MANUAL 1" value={f.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} /></td>
      <td className="px-2 py-1">
        <Select etiqueta="" value={f.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoLinea })}>
          <option value="MULTIPACK">MULTIPACK</option>
          <option value="MANUAL">MANUAL</option>
        </Select>
      </td>
      <td className="px-2 py-1"><Campo etiqueta="" type="number" min={0} step="0.01" placeholder="306" value={f.capacidadKgHora} onChange={(e) => cambiar({ capacidadKgHora: e.target.value })} /></td>
      <td className="px-2 py-1"><Campo etiqueta="" type="number" min={0} value={f.orden} onChange={(e) => cambiar({ orden: e.target.value })} /></td>
    </>
  )

  const error = crear.error ?? actualizar.error ?? cambiarActivo.error

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Líneas de producción</h1>
      <Alerta tipo="info">
        El <strong>nombre</strong> debe ser el mismo que usa PepsiCo en el DPP (“MANUAL 1”, “REEMPAQU 2”): así el importador del
        PDF reconoce la línea. La capacidad en kg/h es la fila “Capacity” del schedule y da el “Pct Overpull”.
      </Alerta>

      {error && <Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 w-32">Código</th><th className="px-2 py-2">Nombre (PepsiCo)</th><th className="px-2 py-2 w-32">Tipo</th>
              <th className="px-2 py-2 w-28">kg/h</th><th className="px-2 py-2 w-20">Orden</th><th className="px-2 py-2 w-24">Estado</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lineas.data?.map((l) => {
              const e = edicion[l.id]
              return (
                <tr key={l.id} className={l.activo ? '' : 'text-slate-400'}>
                  {e ? editor(e, (c) => setEdicion({ ...edicion, [l.id]: { ...e, ...c } })) : (
                    <>
                      <td className="px-2 py-2 font-mono">{l.codigo}</td>
                      <td className="px-2 py-2">{l.nombre}</td>
                      <td className="px-2 py-2">{l.tipo}</td>
                      <td className="px-2 py-2">{l.capacidadKgHora ?? '—'}</td>
                      <td className="px-2 py-2">{l.orden}</td>
                    </>
                  )}
                  <td className="px-2 py-2">{l.activo ? 'Activa' : 'Inactiva'}</td>
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {e ? (
                      <>
                        <button className="text-marca hover:underline" onClick={() => actualizar.mutate(l)}>Guardar</button>
                        <button className="ml-3 text-slate-600 hover:underline" onClick={() => setEdicion((x) => { const { [l.id]: _q, ...r } = x; return r })}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="text-marca hover:underline" onClick={() => setEdicion({ ...edicion, [l.id]: { codigo: l.codigo, nombre: l.nombre, tipo: l.tipo, capacidadKgHora: l.capacidadKgHora?.toString() ?? '', orden: String(l.orden) } })}>Editar</button>
                        <button className="ml-3 text-slate-600 hover:underline" onClick={() => cambiarActivo.mutate(l)}>{l.activo ? 'Desactivar' : 'Activar'}</button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
            {lineas.data?.length === 0 && <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-500">Sin líneas.</td></tr>}
            <tr className="bg-slate-50">
              {editor(nueva, (c) => setNueva({ ...nueva, ...c }))}
              <td className="px-2 py-1 text-xs text-slate-500">nueva</td>
              <td className="px-2 py-1 text-right">
                <Boton cargando={crear.isPending} disabled={!nueva.codigo || !nueva.nombre} onClick={() => crear.mutate()}>Crear</Boton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
