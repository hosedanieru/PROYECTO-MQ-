/**
 * BOTONES DE FLUJO
 * ================
 *
 * Muestra solo las acciones válidas para el estado actual Y que el
 * usuario tiene permiso de ejecutar. Las que piden datos (aprobar,
 * rechazar, validar) abren un diálogo; entregar y rectificar piden
 * confirmación simple.
 *
 *   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
 *                    ▲              │
 *                    │              ▼
 *                    └── EN_RECTIFICACION ◄── RECHAZADA
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { Remision } from '../../../shared/types/remision'
import { useSesion } from '../../auth/useSesion'
import { useAccionRemision, type AccionRemision } from '../hooks/useRemisiones'

type Tipo = AccionRemision['tipo']

interface Definicion {
  tipo: Tipo
  texto: string
  permiso: string
  variante: 'primario' | 'secundario' | 'peligro'
  /** Si pide datos, título del diálogo. */
  dialogo?: string
}

const ACCIONES_POR_ESTADO: Record<Remision['estado'], Definicion[]> = {
  BORRADOR: [
    { tipo: 'entregar', texto: 'Entregar al OPA', permiso: 'remision.entregar', variante: 'primario' },
  ],
  ENTREGADA: [
    { tipo: 'aprobar', texto: 'Registrar aprobación', permiso: 'remision.registrar_aprobacion', variante: 'primario', dialogo: 'Aprobación del OPA' },
    { tipo: 'rechazar', texto: 'Registrar rechazo', permiso: 'remision.registrar_aprobacion', variante: 'peligro', dialogo: 'Rechazo del OPA' },
  ],
  APROBADA: [
    { tipo: 'validar', texto: 'Validar (conciliar)', permiso: 'remision.validar', variante: 'primario', dialogo: 'Conciliación interna' },
  ],
  RECHAZADA: [
    { tipo: 'rectificar', texto: 'Rectificar', permiso: 'remision.rectificar', variante: 'primario' },
  ],
  EN_RECTIFICACION: [
    { tipo: 'entregar', texto: 'Entregar de nuevo', permiso: 'remision.entregar', variante: 'primario' },
  ],
  VALIDADA: [],
}

export function AccionesRemision({ remision }: { remision: Remision }) {
  const { tienePermiso } = useSesion()
  const accion = useAccionRemision(remision.id)
  const [abierta, setAbierta] = useState<Definicion | null>(null)
  const [campos, setCampos] = useState({ opaNombre: '', opaCargo: '', motivo: '', concilidadoCon: '' })

  const disponibles = ACCIONES_POR_ESTADO[remision.estado].filter((a) =>
    tienePermiso(a.permiso),
  )

  const ejecutar = async (def: Definicion) => {
    let carga: AccionRemision
    switch (def.tipo) {
      case 'entregar':
      case 'rectificar':
        if (!window.confirm(`¿Confirma "${def.texto}" para la remisión ${remision.consecutivo}?`)) return
        carga = { tipo: def.tipo }
        break
      case 'aprobar':
        carga = { tipo: 'aprobar', opaNombre: campos.opaNombre, opaCargo: campos.opaCargo || undefined }
        break
      case 'rechazar':
        carga = { tipo: 'rechazar', motivo: campos.motivo }
        break
      case 'validar':
        carga = { tipo: 'validar', concilidadoCon: campos.concilidadoCon }
        break
    }
    try {
      await accion.mutateAsync(carga)
      setAbierta(null)
      setCampos({ opaNombre: '', opaCargo: '', motivo: '', concilidadoCon: '' })
    } catch {
      // el error se muestra abajo desde accion.error
    }
  }

  if (disponibles.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {disponibles.map((def) => (
          <Boton
            key={def.tipo}
            variante={def.variante}
            cargando={accion.isPending && !abierta}
            onClick={() => (def.dialogo ? setAbierta(def) : void ejecutar(def))}
          >
            {def.texto}
          </Boton>
        ))}
      </div>

      {accion.isError && !abierta && (
        <Alerta tipo="error">{comoErrorApi(accion.error).mensaje}</Alerta>
      )}

      <Dialogo
        abierto={abierta !== null}
        titulo={abierta?.dialogo ?? ''}
        onCerrar={() => setAbierta(null)}
      >
        {abierta && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void ejecutar(abierta)
            }}
          >
            {abierta.tipo === 'aprobar' && (
              <>
                <p className="text-sm text-tinta-suave">
                  El OPA no es usuario del sistema: se registra su nombre y cargo como dato.
                </p>
                <Campo
                  etiqueta="Nombre del OPA"
                  required
                  minLength={3}
                  value={campos.opaNombre}
                  onChange={(e) => setCampos({ ...campos, opaNombre: e.target.value })}
                  autoFocus
                />
                <Campo
                  etiqueta="Cargo (opcional)"
                  value={campos.opaCargo}
                  onChange={(e) => setCampos({ ...campos, opaCargo: e.target.value })}
                />
              </>
            )}
            {abierta.tipo === 'rechazar' && (
              <AreaTexto
                etiqueta="Motivo del rechazo (obligatorio)"
                required
                minLength={5}
                rows={3}
                value={campos.motivo}
                onChange={(e) => setCampos({ ...campos, motivo: e.target.value })}
                autoFocus
              />
            )}
            {abierta.tipo === 'validar' && (
              <Campo
                etiqueta="Contacto de PepsiCo con quien se concilió"
                required
                minLength={3}
                value={campos.concilidadoCon}
                onChange={(e) => setCampos({ ...campos, concilidadoCon: e.target.value })}
                autoFocus
              />
            )}

            {accion.isError && <Alerta tipo="error">{comoErrorApi(accion.error).mensaje}</Alerta>}

            <div className="flex justify-end gap-2">
              <Boton type="button" variante="secundario" onClick={() => setAbierta(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante={abierta.variante} cargando={accion.isPending}>
                {abierta.texto}
              </Boton>
            </div>
          </form>
        )}
      </Dialogo>
    </div>
  )
}
