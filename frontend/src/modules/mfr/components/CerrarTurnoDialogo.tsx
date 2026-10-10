/**
 * CERRAR EL TURNO
 * ===============
 *
 * Reemplaza los `window.prompt` del cierre. Pide las NOVEDADES del turno
 * (obligatorias, usuario 2026-10-03) y, si el backend responde que hay SKU
 * por debajo de su meta ("ni menos de lo planeado"), muestra los faltantes
 * y pide el motivo en el mismo diálogo.
 *
 * Al cerrar, el servidor guarda la foto del turno (RT-…) y, si era el
 * último turno abierto, la del día (RD-…); aquí se ofrecen sus PDF.
 * Después envía los dos correos del cierre (resumen y remisiones) y el
 * coordinador ve cómo salió cada uno (usuario, 2026-10-10).
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Dialogo } from '../../../components/Dialogo'
import { abrirPdf } from '../../../services/archivos'
import { comoErrorApi } from '../../../services/http'
import type { Producto } from '../../../shared/types/catalogo'
import type { ResultadoCorreoCierre } from '../../../shared/types/correo'
import { MAXIMO_NOVEDADES, MINIMO_NOVEDADES, type ResultadoCierreTurno } from '../../../shared/types/mfr'
import { useCerrarTurno } from '../hooks/useMfr'

interface Faltante {
  productoId: string
  programadoCajas: number
  producidoCajas: number
  faltanteCajas: number
}

interface Props {
  fecha: string
  turno: { turnoId: string; codigo: string; nombre: string }
  productos: Producto[]
  onCerrar: () => void
}

export function CerrarTurnoDialogo({ fecha, turno, productos, onCerrar }: Props) {
  const cerrar = useCerrarTurno()
  const [novedades, setNovedades] = useState('')
  const [motivo, setMotivo] = useState('')
  const [faltantes, setFaltantes] = useState<Faltante[] | null>(null)
  const [resultado, setResultado] = useState<ResultadoCierreTurno | null>(null)

  const largo = novedades.trim().length
  const novedadesValidas = largo >= MINIMO_NOVEDADES && largo <= MAXIMO_NOVEDADES
  const exigeMotivo = faltantes !== null
  const puedeCerrar = novedadesValidas && (!exigeMotivo || motivo.trim().length >= 5)
  const codigo = (id: string) => productos.find((p) => p.id === id)?.codigo ?? id

  const confirmar = () => {
    cerrar.mutate(
      { fechaOperativa: fecha, turnoId: turno.turnoId, novedades: novedades.trim(), motivoFaltante: exigeMotivo ? motivo.trim() : undefined },
      {
        onSuccess: setResultado,
        onError: (e) => {
          const error = comoErrorApi(e)
          if (error.codigo === 'MFR_FALTANTE_SIN_MOTIVO') {
            setFaltantes((error.detalle?.faltantes ?? []) as Faltante[])
            cerrar.reset() // no es un fallo: falta un dato, se pide abajo
          }
        },
      },
    )
  }

  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const verPdf = async (id: string) => {
    setAbriendo(id)
    setErrorPdf(null)
    try {
      await abrirPdf(`/resumenes/${id}/pdf`)
    } catch (e) {
      setErrorPdf(comoErrorApi(e).mensaje)
    } finally {
      setAbriendo(null)
    }
  }

  return (
    // Bloqueado mientras cierra: si se cerrara, el coordinador no vería cómo salieron los correos.
    <Dialogo abierto titulo={`Cerrar el ${turno.codigo} · ${turno.nombre}`} onCerrar={onCerrar} bloqueado={cerrar.isPending}>
      {resultado ? (
        <div className="space-y-3 text-sm">
          <Alerta tipo="exito">
            Turno cerrado. Se guardó el resumen <strong className="cifra">{resultado.resumenTurno.consecutivo}</strong>
            {resultado.resumenDia && (
              <>
                {' '}y, por ser el último turno del día, el resumen del día <strong className="cifra">{resultado.resumenDia.consecutivo}</strong>
              </>
            )}
            .
          </Alerta>
          <ResultadoCorreos correos={resultado.correos} />
          {errorPdf && <Alerta tipo="error">{errorPdf}</Alerta>}
          <div className="flex flex-wrap justify-end gap-2">
            <Boton variante="secundario" onClick={onCerrar}>Listo</Boton>
            {resultado.resumenDia && (
              <Boton variante="secundario" cargando={abriendo === resultado.resumenDia.id} onClick={() => void verPdf(resultado.resumenDia!.id)}>
                Ver resumen del día (PDF)
              </Boton>
            )}
            <Boton cargando={abriendo === resultado.resumenTurno.id} onClick={() => void verPdf(resultado.resumenTurno.id)}>
              Ver resumen del turno (PDF)
            </Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-tinta-suave">
            Cerrar congela los bloques del turno: no se podrán editar después. Se guarda un resumen con
            producción, remisiones, personal, averías e inventario tal como están ahora.
          </p>

          <AreaTexto
            etiqueta="Novedades del turno (obligatorias)"
            rows={5}
            maxLength={MAXIMO_NOVEDADES}
            placeholder="Qué pasó en el turno y qué queda pendiente para el siguiente: paradas, cambios de referencia, faltantes de material…"
            value={novedades}
            onChange={(e) => setNovedades(e.target.value)}
            error={largo > 0 && largo < MINIMO_NOVEDADES ? `Mínimo ${MINIMO_NOVEDADES} caracteres.` : undefined}
          />

          {exigeMotivo && (
            <Alerta tipo="info">
              <p className="font-medium">El {turno.codigo} cierra por debajo de lo programado:</p>
              <ul className="mt-1 list-disc pl-5">
                {faltantes.map((f) => (
                  <li key={f.productoId}>
                    <span className="cifra">{codigo(f.productoId)}</span>: {f.producidoCajas} de {f.programadoCajas} cajas (faltan {f.faltanteCajas})
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <AreaTexto
                  etiqueta="Motivo del faltante (obligatorio, queda auditado)"
                  rows={2}
                  maxLength={500}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
            </Alerta>
          )}

          {cerrar.isError && <Alerta tipo="error">{comoErrorApi(cerrar.error).mensaje}</Alerta>}
          {cerrar.isPending && (
            <p role="status" className="text-tinta-suave">Cerrando el turno y enviando los correos del cierre; puede tardar hasta un minuto.</p>
          )}

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" disabled={cerrar.isPending} onClick={onCerrar}>Cancelar</Boton>
            <Boton variante="peligro" cargando={cerrar.isPending} disabled={!puedeCerrar} onClick={confirmar}>
              Cerrar el turno
            </Boton>
          </div>
        </div>
      )}
    </Dialogo>
  )
}

const NOMBRE_CORREO: Record<ResultadoCorreoCierre['contenido'], string> = {
  RESUMEN: 'El correo del resumen',
  REMISIONES: 'El correo de las remisiones',
}

/** Qué pasó con cada correo del cierre. Un fallo no deshizo el cierre: se reenvía desde Correos. */
function ResultadoCorreos({ correos }: { correos: ResultadoCorreoCierre[] }) {
  return (
    <ul className="space-y-2">
      {correos.map((c) => (
        <li key={c.contenido}>
          {c.estado === 'ENVIADO' ? (
            <Alerta tipo="exito">
              {NOMBRE_CORREO[c.contenido]} se envió a <span className="cifra">{c.destinatarios}</span>{' '}
              {c.destinatarios === 1 ? 'destinatario' : 'destinatarios'}.
            </Alerta>
          ) : c.estado === 'SIN_DESTINATARIOS' ? (
            <Alerta tipo="info">
              {NOMBRE_CORREO[c.contenido]} no se envió: ninguna lista lo recibe. Se configura en Administración › Correos.
            </Alerta>
          ) : (
            <Alerta tipo="error">
              {NOMBRE_CORREO[c.contenido]} no se pudo enviar{c.error ? ` (${c.error})` : ''}. El turno sí quedó cerrado;
              {c.envioId ? ' reenvíelo desde Administración › Correos.' : ' avise al administrador para enviarlo a mano.'}
            </Alerta>
          )}
        </li>
      ))}
    </ul>
  )
}
