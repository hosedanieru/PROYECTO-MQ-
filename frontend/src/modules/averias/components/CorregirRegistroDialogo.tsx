/**
 * Corrección de un registro por el administrador. Solo se envía lo que
 * cambió; las fotos no se tocan. El backend audita valor anterior y nuevo.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import {
  NOMBRE_UNIDAD,
  UNIDADES_MEDIDA_AVERIA,
  type CambiosRegistroAveria,
  type RegistroAveria,
  type UnidadMedidaAveria,
} from '../../../shared/types/averia'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { useCausales, useCorregirRegistroAveria } from '../hooks/useAverias'

interface Props {
  reporteId: string
  registro: RegistroAveria
  onCerrar: () => void
}

export function CorregirRegistroDialogo({ reporteId, registro, onCerrar }: Props) {
  const productos = useProductos({ soloActivos: true })
  const causales = useCausales()
  const corregir = useCorregirRegistroAveria()
  const [form, setForm] = useState({
    productoId: registro.productoId,
    fechaVencimiento: registro.fechaVencimiento,
    lote: registro.lote,
    causalId: registro.causalId,
    cantidad: String(registro.cantidad),
    unidadMedida: registro.unidadMedida,
  })

  const guardar = () => {
    const cambios: CambiosRegistroAveria = {}
    if (form.productoId !== registro.productoId) cambios.productoId = form.productoId
    if (form.fechaVencimiento !== registro.fechaVencimiento) cambios.fechaVencimiento = form.fechaVencimiento
    if (form.lote.trim() !== registro.lote) cambios.lote = form.lote.trim()
    if (form.causalId !== registro.causalId) cambios.causalId = form.causalId
    if (Number(form.cantidad) !== registro.cantidad) cambios.cantidad = Number(form.cantidad)
    if (form.unidadMedida !== registro.unidadMedida) cambios.unidadMedida = form.unidadMedida
    corregir.mutate({ id: reporteId, args: { registroId: registro.id, cambios } }, { onSuccess: onCerrar })
  }

  return (
    <Dialogo abierto titulo="Corregir avería" onCerrar={onCerrar}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); guardar() }}>
        <Select etiqueta="PT" value={form.productoId} onChange={(e) => setForm({ ...form, productoId: e.target.value })}>
          {/* Si el producto se desactivó, se sigue mostrando el que tiene el registro. */}
          {!productos.data?.some((p) => p.id === registro.productoId) && (
            <option value={registro.productoId}>{registro.productoCodigo} · {registro.productoDescripcion}</option>
          )}
          {productos.data?.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion}</option>)}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Vencimiento" type="date" value={form.fechaVencimiento} onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })} />
          <Campo etiqueta="Lote" maxLength={60} value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} />
          <Campo etiqueta="Cantidad" type="number" min={1} step={1} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
          <Select etiqueta="Unidad" value={form.unidadMedida} onChange={(e) => setForm({ ...form, unidadMedida: e.target.value as UnidadMedidaAveria })}>
            {UNIDADES_MEDIDA_AVERIA.map((u) => <option key={u} value={u}>{NOMBRE_UNIDAD[u]}</option>)}
          </Select>
        </div>
        <Select etiqueta="Causal" value={form.causalId} onChange={(e) => setForm({ ...form, causalId: e.target.value })}>
          {causales.data?.filter((c) => c.activo || c.id === registro.causalId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        {corregir.isError && <Alerta tipo="error">{comoErrorApi(corregir.error).mensaje}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={corregir.isPending}>Guardar corrección</Boton>
        </div>
      </form>
    </Dialogo>
  )
}
