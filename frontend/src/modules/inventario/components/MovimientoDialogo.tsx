/**
 * REGISTRAR MOVIMIENTO
 * ====================
 *
 * Entrada o salida (coordinador, patinador) y ajuste (administrador).
 * El ajuste se pide como "existencia física contada": la diferencia con
 * la existencia del sistema la calcula la pantalla, y es lo que se
 * envía. Así no hay que pensar en signos después de un conteo.
 *
 * Fecha, hora y turno los pone el servidor.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { ItemInventario } from '../../../shared/types/inventario'
import { cantidad as fmt } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useRegistrarAjuste, useRegistrarMovimiento } from '../hooks/useInventario'

type Modo = 'ENTRADA' | 'SALIDA' | 'AJUSTE'

const TITULO: Record<Modo, string> = { ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste por conteo' }

interface Props {
  item: ItemInventario
  onCerrar: () => void
}

export function MovimientoDialogo({ item, onCerrar }: Props) {
  const { tienePermiso } = useSesion()
  const puedeAjustar = tienePermiso('inventario.ajustar')
  const movimiento = useRegistrarMovimiento()
  const ajuste = useRegistrarAjuste()

  const [modo, setModo] = useState<Modo>('ENTRADA')
  const [valor, setValor] = useState('')
  const [referencia, setReferencia] = useState('')
  const [observacion, setObservacion] = useState('')
  const [motivo, setMotivo] = useState('')

  const numero = Number(valor.replace(',', '.'))
  const valido = valor.trim() !== '' && Number.isFinite(numero) && numero >= 0
  const diferencia = modo === 'AJUSTE' && valido ? Math.round((numero - item.existencia) * 1000) / 1000 : null
  const saldoPrevisto = modo === 'ENTRADA' ? item.existencia + numero : modo === 'SALIDA' ? item.existencia - numero : numero
  const mutacion = modo === 'AJUSTE' ? ajuste : movimiento

  const puedeEnviar =
    valido &&
    (modo === 'AJUSTE' ? diferencia !== 0 && motivo.trim() !== '' : numero > 0 && saldoPrevisto >= 0) &&
    !mutacion.isPending

  const enviar = () => {
    const observacionFinal = observacion.trim() || undefined
    if (modo === 'AJUSTE') {
      ajuste.mutate({ itemId: item.id, cantidad: diferencia!, motivo: motivo.trim(), observacion: observacionFinal }, { onSuccess: onCerrar })
    } else {
      movimiento.mutate(
        { itemId: item.id, tipo: modo, cantidad: numero, referencia: referencia.trim() || undefined, observacion: observacionFinal },
        { onSuccess: onCerrar },
      )
    }
  }

  const modos: Modo[] = puedeAjustar ? ['ENTRADA', 'SALIDA', 'AJUSTE'] : ['ENTRADA', 'SALIDA']

  return (
    <Dialogo abierto titulo={`Movimiento · ${item.codigo}`} onCerrar={onCerrar}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (puedeEnviar) enviar() }}>
        <div className="rounded-lg bg-velo px-3 py-2 text-sm">
          <p className="font-medium text-tinta">{item.descripcion}</p>
          <p className="text-tinta-suave">Existencia actual: <span className="cifra font-semibold text-tinta">{fmt(item.existencia)} {item.unidadMedida}</span></p>
        </div>

        <div className="flex gap-2">
          {modos.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setModo(m); setValor('') }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${modo === m ? 'border-marca bg-marca-claro text-marca-texto' : 'border-borde text-tinta-suave'}`}
            >
              {TITULO[m]}
            </button>
          ))}
        </div>

        <Campo
          etiqueta={modo === 'AJUSTE' ? `Existencia física contada (${item.unidadMedida}) *` : `Cantidad (${item.unidadMedida}) *`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.001"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />

        {valido && modo !== 'AJUSTE' && numero > 0 && (
          saldoPrevisto < 0
            ? <Alerta tipo="error">No hay suficiente existencia: hay {fmt(item.existencia)} {item.unidadMedida}. Si el conteo físico no coincide, pida un ajuste al administrador.</Alerta>
            : <p className="text-sm text-tinta-suave">Quedarán <span className="cifra font-semibold text-tinta">{fmt(saldoPrevisto)} {item.unidadMedida}</span>.</p>
        )}
        {diferencia !== null && (
          diferencia === 0
            ? <p className="text-sm text-tinta-suave">El conteo coincide con el sistema: no hay nada que ajustar.</p>
            : <p className="text-sm text-tinta-suave">Se registrará un ajuste de <span className={`cifra font-semibold ${diferencia < 0 ? 'text-critico' : 'text-exito'}`}>{diferencia > 0 ? '+' : ''}{fmt(diferencia)} {item.unidadMedida}</span>.</p>
        )}

        {modo === 'AJUSTE' ? (
          <AreaTexto etiqueta="Motivo *" rows={2} maxLength={500} placeholder="Ej.: conteo físico del cierre de turno" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        ) : (
          <Campo etiqueta="Referencia (documento de soporte)" maxLength={100} placeholder={modo === 'ENTRADA' ? 'Ej.: remisión de PepsiCo 4512' : 'Ej.: consumo línea L1'} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
        )}
        <AreaTexto etiqueta="Observación" rows={2} maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} />

        {mutacion.isError && <Alerta tipo="error">{comoErrorApi(mutacion.error).mensaje}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={mutacion.isPending} disabled={!puedeEnviar}>Registrar {TITULO[modo].toLowerCase()}</Boton>
        </div>
      </form>
    </Dialogo>
  )
}
