import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import { useAnularReporteAveria } from '../hooks/useAverias'

/** Anular no borra: el reporte queda visible, marcado, con el motivo y en la auditoría. */
export function AnularReporteDialogo({ reporteId, abierto, onCerrar }: { reporteId: string; abierto: boolean; onCerrar: () => void }) {
  const [motivo, setMotivo] = useState('')
  const anular = useAnularReporteAveria()

  return (
    <Dialogo abierto={abierto} titulo="Anular reporte de averías" onCerrar={onCerrar}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          anular.mutate({ id: reporteId, args: motivo.trim() }, { onSuccess: () => { setMotivo(''); onCerrar() } })
        }}
      >
        <p className="text-sm text-tinta-suave">El reporte no se borra: queda marcado como anulado, con el motivo, y deja de contar en los totales.</p>
        <AreaTexto etiqueta="Motivo *" rows={3} maxLength={500} placeholder="Ej.: se envió dos veces" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {anular.isError && <Alerta tipo="error">{comoErrorApi(anular.error).mensaje}</Alerta>}
        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="peligro" cargando={anular.isPending} disabled={!motivo.trim()}>Anular</Boton>
        </div>
      </form>
    </Dialogo>
  )
}
