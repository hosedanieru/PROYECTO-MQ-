/**
 * ENVIAR REMISIONES POR CORREO
 * ============================
 *
 * Reemplaza "Imprimir seleccionadas" (usuario, 2026-10-03): las remisiones
 * elegidas se envían en PDF (el mismo formato de dos por hoja) a las listas
 * marcadas y a los correos que se escriban. El envío queda registrado.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import { useEnviarRemisiones, useListasDistribucion } from '../hooks/useCorreo'

interface Props {
  remisionIds: string[]
  onCerrar: () => void
}

/** Correos escritos a mano: uno por línea, o separados por coma o punto y coma. */
const correosDeTexto = (texto: string) => texto.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean)

export function EnviarCorreoDialogo({ remisionIds, onCerrar }: Props) {
  const listas = useListasDistribucion()
  const enviar = useEnviarRemisiones()
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [otros, setOtros] = useState('')

  const activas = (listas.data ?? []).filter((l) => l.activo)
  const correos = correosDeTexto(otros)
  const destinatarios = new Set([...activas.filter((l) => elegidas.has(l.id)).flatMap((l) => l.correos), ...correos.map((c) => c.toLowerCase())])

  const alternar = (id: string) => {
    const n = new Set(elegidas)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setElegidas(n)
  }

  return (
    <Dialogo abierto titulo={`Enviar ${remisionIds.length} remisión(es) por correo`} onCerrar={onCerrar}>
      {enviar.isSuccess ? (
        <div className="space-y-4">
          <Alerta tipo="exito">Enviado a {enviar.data.destinatarios.length} destinatario(s). Quedó registrado.</Alerta>
          <div className="flex justify-end"><Boton onClick={onCerrar}>Cerrar</Boton></div>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            enviar.mutate({ remisionIds, listaIds: [...elegidas], correos })
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-tinta">Listas</legend>
            {activas.length === 0 && <p className="text-sm text-tinta-suave">No hay listas. Un administrador las crea en Administración → Correos.</p>}
            {activas.map((l) => (
              <label key={l.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={elegidas.has(l.id)} onChange={() => alternar(l.id)} />
                <span>
                  <span className="font-medium text-tinta">{l.nombre}</span>{' '}
                  <span className="text-tinta-suave">({l.correos.length} correo(s): {l.correos.slice(0, 3).join(', ')}{l.correos.length > 3 ? '…' : ''})</span>
                </span>
              </label>
            ))}
          </fieldset>
          <AreaTexto etiqueta="Otros correos (uno por línea o separados por coma)" rows={2} value={otros} onChange={(e) => setOtros(e.target.value)} />
          <p className="text-sm text-tinta-suave">Se envía el PDF (dos por hoja) a {destinatarios.size} destinatario(s).</p>
          {enviar.isError && <Alerta tipo="error">{comoErrorApi(enviar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
            <Boton type="submit" cargando={enviar.isPending} disabled={destinatarios.size === 0}>Enviar</Boton>
          </div>
        </form>
      )}
    </Dialogo>
  )
}
