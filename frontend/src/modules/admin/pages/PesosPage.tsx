/**
 * PESOS POR CAJA (ESTÁNDAR DEL MFR)
 * =================================
 *
 * Sin el peso neto de una caja el tablero no puede mostrar kilogramos:
 * Target/Instant/Capacity/Overpull quedan vacíos y el día arrastra una
 * advertencia por cada SKU sin peso.
 *
 * Esta pantalla existe para cargarlos de una sola pasada, pero **sin
 * aplicar nada solo**: la regla del área es que el sistema *sugiere* y
 * el administrador *confirma*. Por eso los campos arrancan vacíos y la
 * sugerencia se muestra al lado; "Proponer todos" solo los llena, no
 * guarda. Lo que se envía es exactamente lo que quedó escrito.
 *
 * Todo el lote va en una transacción con un motivo común, que queda en
 * la auditoría de cada producto.
 */

import { useMemo, useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { comoErrorApi } from '../../../services/http'
import type { CambioEstandarLote, EstandarProducto, ResultadoLoteEstandares } from '../../../shared/types/mfr'
import { useSesion } from '../../auth/useSesion'
import { useActualizarEstandaresEnLote, useEstandares } from '../../mfr/hooks/useMfr'

/** Tope del backend: una transacción de Firestore no admite más. */
const MAXIMO_POR_LOTE = 100

/** Texto del campo → kilos. `null` = vacío; `NaN` = escrito pero inválido. */
function aKilos(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '') return null
  const valor = Number(limpio)
  return Number.isFinite(valor) && valor > 0 ? valor : Number.NaN
}

export function PesosPage() {
  const estandares = useEstandares()
  const aplicar = useActualizarEstandaresEnLote()
  const { tienePermiso } = useSesion()
  const puedeEditar = tienePermiso('catalogo.editar_estandares')

  const [texto, setTexto] = useState('')
  const [soloSinPeso, setSoloSinPeso] = useState(true)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<ResultadoLoteEstandares | null>(null)

  const filas = useMemo(() => {
    const busqueda = texto.trim().toUpperCase()
    return (estandares.data ?? []).filter(
      (e) =>
        (!soloSinPeso || e.pesoNetoKg === null) &&
        (busqueda === '' || e.codigo.includes(busqueda) || e.descripcion.toUpperCase().includes(busqueda)),
    )
  }, [estandares.data, soloSinPeso, texto])

  /** Solo entran al lote los que tienen un valor válido y distinto del actual. */
  const cambios = useMemo<CambioEstandarLote[]>(() => {
    const lista: CambioEstandarLote[] = []
    for (const [productoId, escrito] of Object.entries(valores)) {
      const kilos = aKilos(escrito)
      if (kilos === null || Number.isNaN(kilos)) continue
      const actual = estandares.data?.find((e) => e.productoId === productoId)
      if (actual && actual.pesoNetoKg !== kilos) lista.push({ productoId, pesoNetoKg: kilos })
    }
    return lista
  }, [valores, estandares.data])

  const hayInvalidos = Object.values(valores).some((v) => Number.isNaN(aKilos(v)))
  const excedeTope = cambios.length > MAXIMO_POR_LOTE
  const motivoValido = motivo.trim().length >= 5

  const escribir = (productoId: string, valor: string) =>
    setValores((previos) => ({ ...previos, [productoId]: valor }))

  const proponerTodos = () =>
    setValores((previos) => {
      const siguiente = { ...previos }
      for (const fila of filas) {
        if (fila.pesoSugeridoKg !== null && !siguiente[fila.productoId]) {
          siguiente[fila.productoId] = String(fila.pesoSugeridoKg)
        }
      }
      return siguiente
    })

  const enviar = () => {
    setResultado(null)
    aplicar.mutate(
      { cambios, motivo: motivo.trim() },
      {
        onSuccess: (r) => {
          setResultado(r)
          setValores({})
          setMotivo('')
        },
      },
    )
  }

  const sinSugerencia = filas.filter((f) => f.pesoSugeridoKg === null).length

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-tinta">Pesos por caja</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Kilos netos de una caja. Sin este dato el tablero del MFR no puede mostrar kilogramos. El sistema propone un
          valor leyendo la descripción de PepsiCo; usted decide cuáles acepta.
        </p>
      </header>

      {!puedeEditar && (
        <Alerta tipo="info">
          Puede consultar los pesos, pero cambiarlos exige el permiso <strong>catalogo.editar_estandares</strong>, que
          hoy solo tiene el administrador.
        </Alerta>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Campo
            etiqueta="Buscar por código o descripción"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-tinta">
          <input type="checkbox" checked={soloSinPeso} onChange={(e) => setSoloSinPeso(e.target.checked)} />
          Solo los que no tienen peso
        </label>
        {puedeEditar && (
          <Boton type="button" variante="secundario" onClick={proponerTodos}>
            Proponer todos los sugeridos
          </Boton>
        )}
      </div>

      {estandares.isError && <Alerta tipo="error">{comoErrorApi(estandares.error).mensaje}</Alerta>}

      {resultado && (
        <Alerta tipo="exito">
          Se actualizaron <strong>{resultado.actualizados.length}</strong> producto(s).
          {resultado.sinCambios.length > 0 && (
            <> {resultado.sinCambios.length} ya tenían ese mismo valor y no se tocaron: {resultado.sinCambios.join(', ')}.</>
          )}
        </Alerta>
      )}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Familia</th>
              <th className="px-4 py-2 text-right">Peso actual</th>
              <th className="px-4 py-2 text-right">Sugerido</th>
              <th className="px-4 py-2">Peso nuevo (kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-tinta-suave">
                  {soloSinPeso ? 'Todos los productos tienen peso.' : 'Sin productos.'}
                </td>
              </tr>
            )}
            {filas.map((fila) => (
              <FilaPeso
                key={fila.productoId}
                fila={fila}
                valor={valores[fila.productoId] ?? ''}
                editable={puedeEditar}
                onEscribir={(v) => escribir(fila.productoId, v)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {sinSugerencia > 0 && (
        <p className="text-xs text-tinta-suave">
          {sinSugerencia} producto(s) sin sugerencia: su descripción no sigue ninguno de los formatos conocidos del DPP.
          Hay que escribir el peso a mano.
        </p>
      )}

      {puedeEditar && (
        <div className="space-y-3 rounded-lg bg-base p-4 shadow-sm">
          <Campo
            etiqueta="Motivo del cambio (obligatorio, queda en la auditoría de cada producto)"
            placeholder="Ej.: pesos confirmados contra el DPP del 16/09"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          {hayInvalidos && <Alerta tipo="error">Hay pesos escritos que no son un número mayor que cero.</Alerta>}
          {excedeTope && (
            <Alerta tipo="error">
              Un lote admite máximo {MAXIMO_POR_LOTE} productos y lleva {cambios.length}. Aplique por partes.
            </Alerta>
          )}
          {aplicar.isError && <Alerta tipo="error">{comoErrorApi(aplicar.error).mensaje}</Alerta>}
          <div className="flex items-center justify-between">
            <p className="text-sm text-tinta-suave">
              {cambios.length === 0
                ? 'Escriba al menos un peso para habilitar el guardado.'
                : `${cambios.length} producto(s) van a cambiar. Todo entra junto o no entra nada.`}
            </p>
            <Boton
              type="button"
              onClick={enviar}
              cargando={aplicar.isPending}
              disabled={cambios.length === 0 || !motivoValido || hayInvalidos || excedeTope}
            >
              Aplicar {cambios.length > 0 ? `${cambios.length} cambio(s)` : 'cambios'}
            </Boton>
          </div>
        </div>
      )}
    </section>
  )
}

function FilaPeso({
  fila,
  valor,
  editable,
  onEscribir,
}: {
  fila: EstandarProducto
  valor: string
  editable: boolean
  onEscribir: (valor: string) => void
}) {
  const kilos = aKilos(valor)
  const invalido = Number.isNaN(kilos)
  const igualAlActual = kilos !== null && !invalido && fila.pesoNetoKg === kilos

  return (
    <tr>
      <td className="px-4 py-2 cifra">{fila.codigo}</td>
      <td className="px-4 py-2">{fila.descripcion}</td>
      <td className="px-4 py-2 text-xs">{fila.subdescripcion ?? '—'}</td>
      <td className="px-4 py-2 text-right">{fila.pesoNetoKg ?? '—'}</td>
      <td className="px-4 py-2 text-right">
        {fila.pesoSugeridoKg === null ? (
          <span className="text-tinta-suave">—</span>
        ) : editable ? (
          <button type="button" className="text-marca hover:underline" onClick={() => onEscribir(String(fila.pesoSugeridoKg))}>
            {fila.pesoSugeridoKg}
          </button>
        ) : (
          fila.pesoSugeridoKg
        )}
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0.001}
            step="0.001"
            value={valor}
            disabled={!editable}
            aria-label={`Peso nuevo de ${fila.codigo}`}
            onChange={(e) => onEscribir(e.target.value)}
            className={`w-28 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-marca ${
              invalido ? 'border-critico' : 'border-borde'
            }`}
          />
          {valor !== '' && (
            <button type="button" className="text-xs text-tinta-suave hover:underline" onClick={() => onEscribir('')}>
              limpiar
            </button>
          )}
          {igualAlActual && <span className="text-xs text-tinta-suave">sin cambio</span>}
        </div>
      </td>
    </tr>
  )
}
