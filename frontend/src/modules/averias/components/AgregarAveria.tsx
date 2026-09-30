/**
 * "AGREGAR AVERÍA" — una fila del reporte
 * =======================================
 *
 * Los campos del formulario del área (2026-09-28) con sus cambios:
 * código SAP en vez de EAN y causal de una lista administrable (sin valor
 * por defecto). Todo es obligatorio. La "procedencia" no se pide: se
 * pensó reemplazarla por la línea, pero el área la descartó por ahora
 * (las cajas averiadas a veces llegan sin saber de dónde vienen).
 */

import { useMemo, useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import {
  NOMBRE_EVIDENCIA,
  NOMBRE_UNIDAD,
  TIPOS_EVIDENCIA,
  UNIDADES_MEDIDA_AVERIA,
  type RegistroNuevoAveria,
  type TipoEvidencia,
  type UnidadMedidaAveria,
} from '../../../shared/types/averia'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { useCausales } from '../hooks/useAverias'
import { CampoFoto } from './CampoFoto'

type Fotos = Record<TipoEvidencia, File | null>
const SIN_FOTOS: Fotos = { UNIDAD: null, LOTE_FECHA: null, CONJUNTO: null }

export function AgregarAveria({ onAgregar }: { onAgregar: (registro: RegistroNuevoAveria) => void }) {
  const productos = useProductos({ soloActivos: true })
  const causales = useCausales()

  const [busqueda, setBusqueda] = useState('')
  const [productoId, setProductoId] = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [lote, setLote] = useState('')
  const [causalId, setCausalId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [unidadMedida, setUnidadMedida] = useState<UnidadMedidaAveria>('UNIDAD')
  const [fotos, setFotos] = useState<Fotos>(SIN_FOTOS)
  const [error, setError] = useState<string | null>(null)

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const lista = productos.data ?? []
    return t ? lista.filter((p) => p.id === productoId || p.codigo.includes(t) || p.descripcion.toLowerCase().includes(t)) : lista
  }, [productos.data, busqueda, productoId])
  const producto = productos.data?.find((p) => p.id === productoId)
  const causalesActivas = causales.data?.filter((c) => c.activo) ?? []

  const agregar = () => {
    const n = Number(cantidad)
    const faltan = [
      !producto && 'PT',
      !fechaVencimiento && 'fecha de vencimiento',
      !lote.trim() && 'lote',
      !causalId && 'causal',
      !(Number.isInteger(n) && n > 0) && 'cantidad (entero mayor que 0)',
      ...TIPOS_EVIDENCIA.filter((t) => !fotos[t]).map((t) => NOMBRE_EVIDENCIA[t].toLowerCase()),
    ].filter(Boolean)
    if (faltan.length > 0 || !producto) {
      setError(`Falta: ${faltan.join(', ')}.`)
      return
    }
    onAgregar({
      productoId: producto.id,
      productoEtiqueta: `${producto.codigo} · ${producto.descripcion}`,
      fechaVencimiento,
      lote: lote.trim(),
      causalId,
      cantidad: n,
      unidadMedida,
      fotos: fotos as Record<TipoEvidencia, File>,
    })
    // Se limpia la fila; producto, vencimiento y lote suelen repetirse, pero
    // obligar a revisarlos evita arrastrar un dato de la avería anterior.
    setBusqueda(''); setProductoId(''); setFechaVencimiento(''); setLote(''); setCausalId('')
    setCantidad(''); setUnidadMedida('UNIDAD'); setFotos(SIN_FOTOS); setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Campo etiqueta="Buscar producto (código SAP o descripción)" placeholder="300058141 o SURTIDO…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <Select etiqueta="PT *" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          <option value="">— Seleccione el PT —</option>
          {filtrados.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion}</option>
          ))}
        </Select>
        {producto && <p className="text-xs text-tinta-suave">Descripción: <span className="font-medium text-tinta">{producto.descripcion}</span></p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Fecha de vencimiento *" type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
        <Campo etiqueta="# Lote *" placeholder="Ej: L127 23:33 DD AM" maxLength={60} value={lote} onChange={(e) => setLote(e.target.value)} />
        <Select etiqueta="Causal de avería *" value={causalId} onChange={(e) => setCausalId(e.target.value)}>
          <option value="">— Seleccione una causal —</option>
          {causalesActivas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <Campo etiqueta="Cantidad *" type="number" inputMode="numeric" min={1} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-tinta-suave">Unidad de medida *</legend>
          <div className="flex flex-wrap gap-2">
            {UNIDADES_MEDIDA_AVERIA.map((u) => (
              <label key={u} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${unidadMedida === u ? 'border-marca bg-marca-claro text-marca-texto' : 'border-borde text-tinta-suave'}`}>
                <input type="radio" name="unidad" value={u} checked={unidadMedida === u} onChange={() => setUnidadMedida(u)} className="sr-only" />
                {NOMBRE_UNIDAD[u]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {unidadMedida === 'BOLSA' && (
        <Alerta tipo="advertencia">Las bolsas se registran, pero todavía no suman al total en unidades: falta que el área defina cuántas unidades trae una bolsa.</Alerta>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIPOS_EVIDENCIA.map((t) => (
          <CampoFoto key={t} etiqueta={NOMBRE_EVIDENCIA[t]} archivo={fotos[t]} onCambio={(f) => setFotos({ ...fotos, [t]: f })} />
        ))}
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}
      <Boton type="button" variante="secundario" onClick={agregar} className="w-full sm:w-auto">+ Agregar avería</Boton>
    </div>
  )
}
