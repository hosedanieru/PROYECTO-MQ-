/**
 * NUEVA ENTRADA DE MERCANCÍA
 * ==========================
 *
 * Lo que llega en un mismo documento: encabezado (documento de soporte,
 * quién entrega, observación) y líneas (ítem y cantidad). Recibe
 * insumos y PI. Se envía todo junto: o quedan todas las líneas, o
 * ninguna. Fecha, hora, turno y quién recibe los pone el servidor.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { TIPOS_ITEM_ENTRADA, type Conteo, type ItemInventario } from '../../../shared/types/inventario'
import { fechaCorta, fechaOperativaDe } from '../../../shared/utils/fechas'
import { cantidad as fmt } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useItemsInventario, useRegistrarEntrada } from '../hooks/useInventario'
import { CampoConteo } from '../components/CampoConteo'
import { CAMPOS_VACIOS, leerConteo, textoConteo, totalDeConteo, type Campos } from '../conteo'
import { TONO_TIPO } from '../tonos'

/** Lo que llega se digita como viene (rollos, cajas…); el backend lo convierte. */
interface Linea {
  item: ItemInventario
  conteo: Conteo
  /** Total en la medida, para mostrar (el que cuenta lo calcula el backend). */
  total: number
}

export function NuevaEntradaPage() {
  const navegar = useNavigate()
  const { usuario } = useSesion()
  const items = useItemsInventario({ soloActivos: true })
  const registrar = useRegistrarEntrada()

  const [documento, setDocumento] = useState('')
  const [remitente, setRemitente] = useState('')
  const [observacion, setObservacion] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])

  const [busqueda, setBusqueda] = useState('')
  const [itemId, setItemId] = useState('')
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS)

  const elegibles = useMemo(() => {
    const yaAgregados = new Set(lineas.map((l) => l.item.id))
    const t = busqueda.trim().toLowerCase()
    return (items.data ?? []).filter(
      (i) =>
        TIPOS_ITEM_ENTRADA.includes(i.tipo) &&
        !yaAgregados.has(i.id) &&
        (!t || i.codigo.toLowerCase().includes(t) || i.descripcion.toLowerCase().includes(t)),
    )
  }, [items.data, lineas, busqueda])
  const elegido = items.data?.find((i) => i.id === itemId)
  const conteo = leerConteo(campos)
  const total = elegido ? totalDeConteo(conteo, elegido) : null

  const elegir = (id: string) => {
    setItemId(id)
    setCampos(CAMPOS_VACIOS)
  }

  const agregar = () => {
    if (!elegido || total === null) return
    setLineas([...lineas, { item: elegido, conteo, total }])
    elegir('')
    setBusqueda('')
  }

  const enviar = () =>
    registrar.mutate(
      {
        documento: documento.trim(),
        remitente: remitente.trim() || undefined,
        observacion: observacion.trim() || undefined,
        lineas: lineas.map((l) => ({ itemId: l.item.id, conteo: l.conteo })),
      },
      { onSuccess: (entrada) => navegar(`/inventario/entradas/${entrada.id}`, { replace: true }) },
    )

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-tinta">Nueva entrada de mercancía</h2>
          <p className="text-sm text-tinta-suave">Lo que llega en un mismo documento: insumos y PI para reempaque.</p>
        </div>
        <Link to="/inventario/entradas" className="text-sm text-marca hover:underline">← Entradas</Link>
      </header>

      <Tarjeta titulo="Encabezado">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Documento de soporte *" maxLength={100} placeholder="Remisión de PepsiCo, guía, factura…" value={documento} onChange={(e) => setDocumento(e.target.value)} />
          <Campo etiqueta="Quién entrega" maxLength={100} placeholder="PepsiCo, transportador, proveedor…" value={remitente} onChange={(e) => setRemitente(e.target.value)} />
          <div className="space-y-1 text-sm">
            <p className="text-tinta-suave">Fecha, hora y turno</p>
            <p className="font-medium text-tinta">Automáticos al registrar · día operativo {fechaCorta(fechaOperativaDe(new Date()))}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-tinta-suave">Recibe</p>
            <p className="font-medium text-tinta">{usuario?.nombre}</p>
          </div>
          <div className="sm:col-span-2">
            <Campo etiqueta="Observación" maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Agregar línea">
        {items.data && items.data.filter((i) => TIPOS_ITEM_ENTRADA.includes(i.tipo)).length === 0 && (
          <Alerta tipo="advertencia">No hay insumos ni PI creados. Primero se crean en las pestañas PI e Insumos.</Alerta>
        )}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); agregar() }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Buscar" placeholder="Código o descripción" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <Select etiqueta="Ítem *" value={itemId} onChange={(e) => elegir(e.target.value)}>
              <option value="">— Seleccione —</option>
              {elegibles.map((i) => <option key={i.id} value={i.id}>{i.tipo} · {i.codigo} · {i.descripcion}</option>)}
            </Select>
          </div>
          {elegido && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              {/* Como viene: estibas, cajas, rollos… según lo que tenga definido el ítem. */}
              <CampoConteo item={elegido} campos={campos} onCambiar={setCampos} />
              <Boton type="submit" variante="secundario" disabled={total === null}>+ Agregar</Boton>
            </div>
          )}
        </form>
      </Tarjeta>

      <Tarjeta titulo={`Líneas (${lineas.length})`} sinRelleno>
        <table className="min-w-full text-sm">
          <tbody className="divide-y divide-borde">
            {lineas.map((l, i) => (
              <tr key={l.item.id}>
                <td className="px-5 py-2"><Badge tono={TONO_TIPO[l.item.tipo]}>{l.item.tipo}</Badge></td>
                <td className="px-5 py-2"><span className="cifra">{l.item.codigo}</span> <span className="text-tinta-suave">{l.item.descripcion}</span></td>
                <td className="px-5 py-2 text-right">
                  <span className="cifra font-semibold">{fmt(l.total)} {l.item.unidadMedida}</span>
                  <span className="block text-xs text-tinta-suave">{textoConteo(l.conteo, l.item)}</span>
                </td>
                <td className="px-5 py-2 text-right">
                  <button type="button" className="text-critico hover:underline" onClick={() => setLineas(lineas.filter((_, j) => j !== i))}>Quitar</button>
                </td>
              </tr>
            ))}
            {lineas.length === 0 && <tr><td className="px-5 py-4 text-tinta-suave">Todavía no hay líneas.</td></tr>}
          </tbody>
        </table>
      </Tarjeta>

      {registrar.isError && <Alerta tipo="error">{comoErrorApi(registrar.error).mensaje}</Alerta>}
      <div className="flex justify-end">
        <Boton onClick={enviar} cargando={registrar.isPending} disabled={!documento.trim() || lineas.length === 0} className="w-full sm:w-auto">
          Registrar entrada
        </Boton>
      </div>
    </section>
  )
}
