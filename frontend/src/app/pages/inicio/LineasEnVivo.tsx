import { Link } from 'react-router-dom'

import { Badge } from '../../../components/Badge'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import type { Producto } from '../../../shared/types/catalogo'
import type { IndicadoresDia, PersonalLinea } from '../../../shared/types/mfr'
import { estaEnCurso, minutoOperativoActual } from '../../../shared/utils/horas'
import { miles, proporcion } from '../../../shared/utils/numeros'

interface Props {
  dia: IndicadoresDia
  productos: Producto[] | undefined
  /** Día que se está mirando; solo el de hoy tiene bloque "en curso". */
  esHoy: boolean
  fecha: string
}

/**
 * QUÉ SE ESTÁ CORRIENDO EN CADA LÍNEA
 * ===================================
 *
 * LÍMITE IMPORTANTE, y por eso está escrito en la pantalla: la barra es
 * lo PROGRAMADO por el DPP, no lo producido. La remisión no registra en
 * qué línea se empacó (decisión del 2026-09-18), así que el sistema no
 * puede saber cuánto lleva cada línea. Lo producido solo se conoce por
 * SKU y por turno, y eso está en el tablero de MFR.
 *
 * Mostrar aquí una barra de "avance" por línea sería inventar un dato
 * que no existe.
 */
export function LineasEnVivo({ dia, productos, esHoy, fecha }: Props) {
  const minutoActual = minutoOperativoActual(new Date())
  const descripcion = (productoId: string) => productos?.find((p) => p.id === productoId)

  // Personal por línea: viene por turno, así que se aplana a un índice.
  const personalPorLinea = new Map<string, PersonalLinea>(
    dia.turnos.flatMap((turno) => turno.personal.lineas.map((linea) => [linea.lineaId, linea])),
  )

  const conProgramacion = dia.lineas.filter((linea) => linea.bloques.length > 0)
  const mayorTarget = Math.max(...conProgramacion.map((l) => l.targetCajas), 1)

  if (conProgramacion.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-borde px-4 py-10 text-center">
        <p className="text-sm font-semibold text-tinta">Ninguna línea tiene programación este día</p>
        <p className="mt-1 text-sm text-tinta-suave">
          Sin DPP cargado no se puede remisionar.{' '}
          <Link to={`/mfr/programacion?fecha=${fecha}`} className="font-semibold text-marca hover:underline">
            Cargar la programación
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {conProgramacion.map((linea) => {
        const enCurso = esHoy ? linea.bloques.find((b) => estaEnCurso(b, minutoActual)) : undefined
        const producto = enCurso ? descripcion(enCurso.productoId) : undefined
        const personal = personalPorLinea.get(linea.lineaId)

        return (
          <div
            key={linea.lineaId}
            className={`rounded-xl border p-3.5 transition ${
              enCurso ? 'border-marca/40 bg-marca-claro/25' : 'border-borde bg-velo/50'
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-sm font-bold text-tinta">{linea.codigo}</span>
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-suave">
                {linea.tipo}
              </span>

              {enCurso ? (
                <Badge tono="marca" punto>
                  {enCurso.horaInicio}–{enCurso.horaFin}
                </Badge>
              ) : (
                <Badge tono="neutro">{linea.bloques.length} bloque(s) el día</Badge>
              )}

              {personal && personal.requeridasDpp > 0 && (
                <Badge tono={personal.estado === 'CUBIERTA' ? 'exito' : 'alerta'}>
                  {personal.personas} de {personal.requeridasDpp} personas
                </Badge>
              )}

              <span className="cifra ml-auto text-sm font-bold text-tinta">
                {miles(linea.targetCajas)}
                <span className="ml-1 text-xs font-medium text-tinta-suave">cajas programadas</span>
              </span>
            </div>

            <p className="mt-1.5 truncate text-xs text-tinta-suave">
              {enCurso
                ? `Corriendo ahora: ${producto?.codigo ?? '—'} · ${producto?.descripcion ?? 'producto sin catálogo'}`
                : `${linea.horasProgramadas} h programadas en el día`}
            </p>

            <div className="mt-2.5">
              <BarraProgreso
                valor={proporcion(linea.targetCajas, mayorTarget) ?? 0}
                tono={enCurso ? 'marca' : 'neutro'}
                titulo={`${linea.codigo}: ${miles(linea.targetCajas)} cajas programadas`}
              />
            </div>
          </div>
        )
      })}

      <p className="pt-1 text-xs leading-relaxed text-tinta-suave">
        La barra compara lo <strong>programado</strong> por el DPP entre líneas. No es avance de
        producción: la remisión no registra la línea, así que lo producido se conoce por SKU y por
        turno, en el{' '}
        <Link to={`/mfr?fecha=${fecha}`} className="font-semibold text-marca hover:underline">
          tablero de MFR
        </Link>
        .
      </p>
    </div>
  )
}
