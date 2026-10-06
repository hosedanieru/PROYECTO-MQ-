/**
 * CIERRE DEL DÍA — conteo físico y merma
 * ======================================
 *
 * Decisiones del usuario (2026-10-01): al cierre de cada día operativo se
 * cuentan los PI e insumos que usan las recetas. Por cada uno se ve:
 *
 *   sistema      lo que dice el inventario
 *   en tránsito  lo que gastaron remisiones producidas pero aún sin aprobar
 *   esperado     sistema − en tránsito (lo que debería haber)
 *   contado      lo que hay físicamente (se digita como viene: rollos, cajas…)
 *   merma        esperado − contado (negativa = sobrante)
 *
 * El cálculo y el ajuste los hace el backend; aquí la merma se muestra
 * mientras se digita. Si el día ya se cerró, se muestra el resultado.
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { BarraProporcion } from '../../../components/BarraProporcion'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dato } from '../../../components/Dato'
import { Ficha } from '../../../components/Ficha'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import type { CierreInventario, CierrePreparado } from '../../../shared/types/inventario'
import { fechaCorta, fechaHora, fechaOperativaDe } from '../../../shared/utils/fechas'
import { cantidad, porcentaje } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { CampoConteo } from '../components/CampoConteo'
import { CAMPOS_VACIOS, leerConteo, totalDeConteo, type Campos } from '../conteo'
import { usePrepararCierre, useRegistrarCierre } from '../hooks/useInventario'
import { redondear } from '../receta'

export function CierrePage() {
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? fechaOperativaDe(new Date())
  const preparado = usePrepararCierre(fecha)
  const { tienePermiso } = useSesion()

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-borde pb-5">
        <p className="max-w-2xl text-sm text-tinta-suave">
          Conteo físico de los materiales que usan las recetas. La <strong>merma</strong> es lo que falta frente a lo esperado; lo producido y aún sin aprobar
          (<strong>en tránsito</strong>) ya se descuenta para que no parezca merma.
        </p>
        <div className="w-44">
          <Campo etiqueta="Día operativo" type="date" value={fecha} onChange={(e) => e.target.value && setParams({ fecha: e.target.value }, { replace: true })} />
        </div>
      </header>

      {preparado.isError && <Alerta tipo="error">{comoErrorApi(preparado.error).mensaje}</Alerta>}
      {preparado.data?.cierre && <DetalleCierre cierre={preparado.data.cierre} />}
      {preparado.data && !preparado.data.cierre && preparado.data.materiales.length === 0 && (
        <Alerta tipo="info">No hay materiales que contar: ninguna receta vigente usa PI o insumos. Digite las recetas de los PT primero.</Alerta>
      )}
      {preparado.data && !preparado.data.cierre && preparado.data.materiales.length > 0 && (
        tienePermiso('inventario.ajustar')
          ? <FormularioCierre key={fecha} preparado={preparado.data} />
          : <Alerta tipo="info">El {fechaCorta(fecha)} todavía no tiene cierre.</Alerta>
      )}
    </section>
  )
}

function FormularioCierre({ preparado }: { preparado: CierrePreparado }) {
  const registrar = useRegistrarCierre()
  const [campos, setCampos] = useState<Record<string, Campos>>({})
  const [observacion, setObservacion] = useState('')

  const filas = preparado.materiales.map((m) => {
    const c = campos[m.itemId] ?? CAMPOS_VACIOS
    const digitado = Object.values(c).some((v) => v.trim() !== '')
    const contado = digitado ? totalDeConteo(leerConteo(c), { equivalencias: m.equivalencias }, true) : null
    return { m, c, contado, merma: contado === null ? null : redondear(m.esperado - contado) }
  })
  const completo = filas.every((f) => f.contado !== null)

  const enviar = () =>
    registrar.mutate({
      fechaOperativa: preparado.fechaOperativa,
      lineas: filas.map((f) => ({ itemId: f.m.itemId, conteo: leerConteo(f.c) })),
      observacion: observacion.trim() || undefined,
    })

  return (
    <div className="space-y-4">
      <Tarjeta titulo={`Conteo del ${fechaCorta(preparado.fechaOperativa)} (${filas.length} materiales)`} descripcion="Se cuentan todos. Digite lo que hay como viene: estibas, cajas, rollos o la medida suelta." sinRelleno>
        <ul className="divide-y divide-borde">
          {filas.map(({ m, c, merma }) => (
            <li key={m.itemId} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_10rem]">
              <div className="text-sm">
                <p><span className="cifra font-medium text-tinta">{m.codigo}</span> <span className="text-tinta-suave">{m.descripcion}</span></p>
                <p className="mt-1 text-xs text-tinta-suave">
                  Sistema <span className="cifra">{cantidad(m.existenciaSistema)}</span> − en tránsito <span className="cifra">{cantidad(m.enTransito)}</span> ={' '}
                  esperado <strong className="cifra text-tinta">{cantidad(m.esperado)} {m.unidad}</strong>
                </p>
                {m.esperado < 0 && (
                  <p className="mt-1 text-xs text-alerta">
                    Las remisiones sin aprobar necesitan más de lo que tiene el sistema: probablemente falta registrar una entrada de mercancía. Regístrela antes del
                    cierre, o el resultado saldrá como un sobrante que no es real.
                  </p>
                )}
              </div>
              <CampoConteo item={{ unidadMedida: m.unidad, equivalencias: m.equivalencias }} campos={c} onCambiar={(nuevo) => setCampos({ ...campos, [m.itemId]: nuevo })} permitirCero />
              <div className="text-sm lg:text-right">
                <p className="text-xs text-tinta-suave">Merma</p>
                <TextoMerma merma={merma} unidad={m.unidad} />
              </div>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <AreaTexto etiqueta="Observación" rows={2} maxLength={500} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
      {registrar.isError && <Alerta tipo="error">{comoErrorApi(registrar.error).mensaje}</Alerta>}
      <div className="flex items-center justify-end gap-3">
        {!completo && <span className="text-sm text-tinta-suave">Falta contar {filas.filter((f) => f.contado === null).length} material(es).</span>}
        <Boton onClick={enviar} cargando={registrar.isPending} disabled={!completo}>Registrar cierre</Boton>
      </div>
    </div>
  )
}

function TextoMerma({ merma, unidad }: { merma: number | null; unidad: string }) {
  if (merma === null) return <p className="text-tinta-suave">—</p>
  if (merma === 0) return <p className="font-semibold text-exito">Sin diferencia</p>
  return merma > 0
    ? <p className="cifra font-semibold text-critico">{cantidad(merma)} {unidad}</p>
    : <p className="cifra font-semibold text-exito">Sobran {cantidad(-merma)} {unidad}</p>
}

/**
 * Resultado de un cierre ya registrado. Rediseño (usuario, 2026-10-05:
 * la tabla de 7 columnas se veía saturada): ficha con el resumen y una
 * fila por material con la merma grande a la derecha, la cuenta
 * (sistema − en tránsito = esperado → contado) en pequeño y una barra de
 * contado frente a esperado.
 */
function DetalleCierre({ cierre }: { cierre: CierreInventario }) {
  const conMerma = cierre.lineas.filter((l) => l.merma > 0).length
  // Primero lo que tiene merma, de mayor a menor porcentaje: es lo que hay que revisar.
  const lineas = [...cierre.lineas].sort((a, b) => (b.mermaPorcentaje ?? b.merma) - (a.mermaPorcentaje ?? a.merma))
  return (
    <div className="space-y-6">
      <Ficha>
        <Dato etiqueta="Día operativo" valor={fechaCorta(cierre.fechaOperativa)} />
        <Dato etiqueta="Materiales contados" valor={cierre.lineas.length} />
        <Dato etiqueta="Con merma" valor={conMerma} destacado />
        <Dato etiqueta="Registró" valor={cierre.usuarioNombre} nota={fechaHora(cierre.fechaHoraRegistro)} />
      </Ficha>
      {cierre.observacion && (
        <p className="text-sm text-tinta-suave">
          <span className="font-semibold text-tinta">Observación:</span> {cierre.observacion}
        </p>
      )}

      <Seccion
        titulo="Merma por material"
        contador={cierre.lineas.length}
        tono={conMerma > 0 ? 'critico' : 'exito'}
        descripcion="Primero lo que tiene merma. El porcentaje es la merma frente a lo que descontaron las recetas desde el cierre anterior."
      >
        <ListaRegistros>
          {lineas.map((l) => (
            <FilaRegistro
              key={l.itemId}
              tono={l.merma > 0 ? 'critico' : 'exito'}
              titulo={l.descripcion}
              detalle={<span className="cifra">{l.codigo}</span>}
              meta={
                <>
                  <MetaDato etiqueta="Sistema">{cantidad(l.existenciaSistema)}</MetaDato>
                  <MetaDato etiqueta="− en tránsito">{cantidad(l.enTransito)}</MetaDato>
                  <MetaDato etiqueta="= esperado">{cantidad(l.esperado)}</MetaDato>
                  <MetaDato etiqueta="Contado">
                    {cantidad(l.contado)} {l.unidad}
                  </MetaDato>
                  {l.conteoTexto && <span>({l.conteoTexto})</span>}
                </>
              }
              pie={
                <BarraProporcion
                  valor={l.contado}
                  total={l.esperado}
                  tono={l.merma > 0 ? 'critico' : 'exito'}
                  descripcion={`Contado ${cantidad(l.contado)} de ${cantidad(l.esperado)} esperados`}
                />
              }
              // Merma positiva = falta (rojo); negativa = sobrante (se muestra "+" como en TextoMerma).
              cifra={l.merma > 0 ? cantidad(l.merma) : l.merma < 0 ? `+${cantidad(-l.merma)}` : '0'}
              unidad={l.merma === 0 ? undefined : l.unidad}
              colorCifra={l.merma > 0 ? 'text-critico' : 'text-exito'}
              notaCifra={
                l.merma > 0
                  ? `de merma · ${porcentaje(l.mermaPorcentaje)} del consumo`
                  : l.merma < 0
                    ? 'sobran'
                    : 'sin diferencia'
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>
    </div>
  )
}
