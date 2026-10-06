/**
 * FIRMAS DE LA REMISIÓN
 * =====================
 *
 * Las casillas del formato (Inlotrans, verificador, quien recibe,
 * validación) con su firma vigente o pendiente. Firmar abre un diálogo
 * que muestra lo que se firma, la declaración, el recuadro para dibujar y
 * pide la contraseña (el computador de MQ es compartido). Las firmas de
 * versiones anteriores se ven en el historial: no respaldan la versión
 * actual.
 *
 * Quien recibe (OPA, fase 2): "Aprobar y firmar" desde su propia cuenta,
 * solo después de que el verificador firmó el conteo. Aprueba la remisión
 * (y descuenta inventario) y firma en el mismo paso.
 *
 * Los permisos solo OCULTAN el botón; quien decide es el backend.
 */

import { useState, type FormEvent } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Seccion } from '../../../components/Seccion'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { FirmaRemision, Remision, TipoFirma } from '../../../shared/types/remision'
import { fechaHora } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useAprobarFirmando, useFirmarRemision, useFirmasRemision, useValidarFirmando } from '../hooks/useRemisiones'
import { PanelFirma } from './PanelFirma'

const TITULO: Record<TipoFirma, string> = {
  INLOTRANS: 'Firma Inlotrans',
  VERIFICADOR: 'Firma verificador',
  RECIBE: 'Firma quien recibe (OPA)',
  VALIDACION: 'Validación',
}

/** Espejo de las reglas del backend, solo para mostrar u ocultar el botón. */
const HABILITADAS: TipoFirma[] = ['INLOTRANS', 'VERIFICADOR', 'RECIBE', 'VALIDACION']
/** En qué estado se firma cada casilla (validación: con la remisión aprobada). */
const ESTADO_PARA_FIRMAR: Record<TipoFirma, Remision['estado']> = {
  INLOTRANS: 'ENTREGADA',
  VERIFICADOR: 'ENTREGADA',
  RECIBE: 'ENTREGADA',
  VALIDACION: 'APROBADA',
}
const TEXTO_BOTON: Record<TipoFirma, string> = {
  INLOTRANS: 'Firmar',
  VERIFICADOR: 'Firmar',
  RECIBE: 'Aprobar y firmar',
  VALIDACION: 'Validar y firmar',
}
const PERMISO: Record<TipoFirma, string> = {
  INLOTRANS: 'remision.firmar_emision',
  VERIFICADOR: 'remision.firmar_verificacion',
  RECIBE: 'remision.firmar_recepcion',
  VALIDACION: 'remision.validar',
}

export function FirmasRemision({ remision }: { remision: Remision }) {
  const firmas = useFirmasRemision(remision.id)
  const { tienePermiso } = useSesion()
  const [firmando, setFirmando] = useState<{ tipo: TipoFirma; declaracion: string } | null>(null)
  const [verHistorial, setVerHistorial] = useState(false)

  if (firmas.isLoading) return null
  if (firmas.isError) return <Alerta tipo="error">{comoErrorApi(firmas.error).mensaje}</Alerta>
  const datos = firmas.data!
  const anteriores = datos.historial.filter((f) => !f.vigente)

  const puedeFirmar = (tipo: TipoFirma) =>
    HABILITADAS.includes(tipo) && remision.estado === ESTADO_PARA_FIRMAR[tipo] && tienePermiso(PERMISO[tipo])
  /** El OPA firma después del verificador (su declaración se apoya en ese conteo). */
  const verificadorFirmo = datos.casillas.some((c) => c.tipo === 'VERIFICADOR' && c.firma !== null)

  const firmadas = datos.casillas.filter((c) => c.firma).length

  return (
    <Seccion
      titulo="Firmas electrónicas"
      contador={firmadas}
      tono={firmadas === datos.casillas.length ? 'exito' : 'marca'}
      descripcion={
        datos.modo === 'PILOTO'
          ? 'Piloto: mientras no haya aval de PepsiCo y del área legal, conserve también la remisión firmada en papel.'
          : 'Las firmas son obligatorias: sin ellas no se aprueba ni se valida.'
      }
      accion={<Badge tono="neutro">Versión {datos.version}</Badge>}
    >
      {/*
        Sin cajas (usuario, 2026-10-05): cuatro renglones de firma como en
        el formato de papel. Arriba la firma (o lo que falta), una línea, y
        debajo a quién corresponde.
      */}
      <div className="grid gap-x-8 gap-y-8 border-y border-borde py-6 sm:grid-cols-2 lg:grid-cols-4">
        {datos.casillas.map((c) => (
          <div key={c.tipo} className="flex flex-col">
            <div className="flex min-h-28 flex-col justify-end border-b-2 border-tinta/30 pb-2">
              {c.firma ? (
                <img src={c.firma.trazo} alt={`Firma de ${c.firma.usuarioNombre}`} className="h-16 w-full object-contain" />
              ) : puedeFirmar(c.tipo) && c.tipo === 'RECIBE' && !verificadorFirmo ? (
                <p className="text-sm text-alerta">Primero debe firmar el verificador (el conteo).</p>
              ) : puedeFirmar(c.tipo) ? (
                <Boton onClick={() => setFirmando({ tipo: c.tipo, declaracion: c.declaracion })}>{TEXTO_BOTON[c.tipo]}</Boton>
              ) : (
                <p className="text-sm text-tinta-suave">
                  {!HABILITADAS.includes(c.tipo)
                    ? 'Se habilita más adelante.'
                    : remision.estado === ESTADO_PARA_FIRMAR[c.tipo]
                      ? 'Pendiente'
                      : c.tipo === 'VALIDACION'
                        ? 'Se firma al validar la remisión aprobada.'
                        : 'Se firma con la remisión entregada.'}
                </p>
              )}
            </div>
            <p className="mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tinta-suave">
              {c.firma && <span className="h-2 w-2 rounded-full bg-exito" aria-hidden="true" />}
              {TITULO[c.tipo]}
            </p>
            {c.firma ? <Casilla firma={c.firma} /> : <p className="mt-1 text-xs italic text-tinta-suave">«{c.declaracion}»</p>}
          </div>
        ))}
      </div>

      {anteriores.length > 0 && (
        <div className="mt-3">
          <button type="button" className="text-xs font-semibold text-marca hover:underline" onClick={() => setVerHistorial(!verHistorial)}>
            {verHistorial ? 'Ocultar' : 'Ver'} firmas de versiones anteriores ({anteriores.length})
          </button>
          {verHistorial && (
            <ul className="mt-2 space-y-1 text-xs text-tinta-suave">
              {anteriores.map((f) => (
                <li key={f.id}>
                  Versión {f.version} · {TITULO[f.tipo]} · {f.usuarioNombre} · {fechaHora(f.fechaHora)} — ya no aplica (el documento cambió)
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {firmando && (
        <FirmarDialogo
          remision={remision}
          tipo={firmando.tipo}
          declaracion={firmando.declaracion}
          onCerrar={() => setFirmando(null)}
        />
      )}
    </Seccion>
  )
}

/** Quién firmó, cuándo y con qué declaración (la imagen de la firma va arriba, sobre el renglón). */
function Casilla({ firma }: { firma: FirmaRemision }) {
  return (
    <div className="mt-1 space-y-0.5 text-xs">
      <p className="text-sm font-bold text-tinta">{firma.usuarioNombre}</p>
      <p className="text-tinta-suave">{firma.usuarioRol} · doc. {firma.usuarioDocumento}</p>
      <p className="text-tinta-suave">{fechaHora(firma.fechaHora)}</p>
      <p className="italic text-tinta-suave">«{firma.declaracion}»</p>
      <p className="truncate font-mono text-xs text-tinta-suave" title={`Huella SHA-256: ${firma.huella}`}>
        {firma.huella.slice(0, 16)}…
      </p>
    </div>
  )
}

function FirmarDialogo({
  remision, tipo, declaracion, onCerrar,
}: {
  remision: Remision
  tipo: TipoFirma
  declaracion: string
  onCerrar: () => void
}) {
  const firmar = useFirmarRemision(remision.id)
  const aprobarFirmando = useAprobarFirmando(remision.id)
  const validarFirmando = useValidarFirmando(remision.id)
  /** La casilla del OPA aprueba al firmar; la de validación valida; las demás solo firman. */
  const aprueba = tipo === 'RECIBE'
  const valida = tipo === 'VALIDACION'
  const accion = aprueba ? aprobarFirmando : valida ? validarFirmando : firmar
  const { usuario } = useSesion()
  const [trazo, setTrazo] = useState<string | null>(null)
  const [contrasena, setContrasena] = useState('')
  /** Contacto de PepsiCo con quien se concilió (lo pide validar). */
  const [conciliadoCon, setConciliadoCon] = useState('')
  const faltaConciliado = valida && conciliadoCon.trim().length < 3

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (!trazo || !contrasena || faltaConciliado) return
    if (aprueba) aprobarFirmando.mutate({ trazo, contrasena }, { onSuccess: onCerrar })
    else if (valida) validarFirmando.mutate({ concilidadoCon: conciliadoCon.trim(), trazo, contrasena }, { onSuccess: onCerrar })
    else firmar.mutate({ tipo, trazo, contrasena }, { onSuccess: onCerrar })
  }

  return (
    <Dialogo abierto titulo={`${TITULO[tipo]} · remisión ${remision.consecutivo}`} onCerrar={onCerrar}>
      <form onSubmit={enviar} className="space-y-3 text-sm">
        <div className="rounded-md bg-velo p-3">
          <p className="text-xs uppercase text-tinta-suave">Lo que firma (versión {remision.version})</p>
          <p className="font-medium text-tinta">
            <span className="cifra">{remision.producto.codigo}</span> · {remision.producto.descripcion}
          </p>
          <p className="text-tinta-suave">
            {remision.cantidadCajas} cajas · {remision.cantidadUnidades} unidades · {remision.descripcionEstibas}
          </p>
        </div>

        <p className="font-medium text-tinta">«{declaracion}»</p>
        {aprueba && (
          <Alerta tipo="info">
            Al firmar, <strong>usted aprueba la remisión</strong> en nombre de PepsiCo. Si no está conforme, cierre esta
            ventana y use "Registrar rechazo" con el motivo.
          </Alerta>
        )}

        {valida && (
          <Campo
            etiqueta="Conciliado con (contacto de PepsiCo)"
            maxLength={120}
            value={conciliadoCon}
            onChange={(e) => setConciliadoCon(e.target.value)}
          />
        )}

        <PanelFirma onCambio={setTrazo} />

        <Campo
          etiqueta={`Contraseña de ${usuario?.nombre ?? 'su cuenta'}`}
          type="password"
          autoComplete="current-password"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
        <p className="text-xs text-tinta-suave">
          Su firma, nombre, documento, fecha, hora y equipo quedan guardados como evidencia de esta remisión. Si la
          remisión se rectifica, habrá que firmar de nuevo.
        </p>

        {accion.isError && <Alerta tipo="error">{comoErrorApi(accion.error).mensaje}</Alerta>}

        <div className="flex justify-end gap-2">
          <Boton type="button" variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton type="submit" cargando={accion.isPending} disabled={!trazo || !contrasena || faltaConciliado}>
            {TEXTO_BOTON[tipo]}
          </Boton>
        </div>
      </form>
    </Dialogo>
  )
}
