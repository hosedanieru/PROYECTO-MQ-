/**
 * KARDEX DE UN ÍTEM
 * =================
 *
 * Todos los movimientos del ítem, del más reciente al más antiguo, con
 * el saldo que dejó cada uno. Es la trazabilidad: si la existencia no
 * cuadra, aquí se ve qué movimiento la descuadró y quién lo registró.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Dato } from '../../../components/Dato'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_TIPO_ITEM } from '../../../shared/types/inventario'
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas'
import { cantidad } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { useTurnos } from '../../catalogo/hooks/useCatalogos'
import { MovimientoDialogo } from '../components/MovimientoDialogo'
import { useItemInventario, useKardex } from '../hooks/useInventario'
import { TONO_MOVIMIENTO, TONO_TIPO } from '../tonos'

export function KardexPage() {
  const { id = '' } = useParams()
  const item = useItemInventario(id)
  const kardex = useKardex(id)
  const turnos = useTurnos()
  const { tienePermiso } = useSesion()
  const [moviendo, setMoviendo] = useState(false)

  if (item.isLoading) return <PantallaCargando />
  if (!item.data) return <Alerta tipo="error">{item.error ? comoErrorApi(item.error).mensaje : 'No se encontró el ítem.'}</Alerta>
  const i = item.data
  const turno = (tid: string) => turnos.data?.find((t) => t.id === tid)?.codigo ?? '—'

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/inventario" className="text-sm text-marca hover:underline">← Existencias</Link>
          <h2 className="mt-1 flex items-center gap-3 text-xl font-semibold text-tinta">
            <span className="cifra">{i.codigo}</span>
            <Badge tono={TONO_TIPO[i.tipo]}>{i.tipo}</Badge>
            {!i.activo && <Badge tono="neutro">Inactivo</Badge>}
          </h2>
          <p className="text-sm text-tinta-suave">{i.descripcion}</p>
        </div>
        {tienePermiso('inventario.registrar') && i.activo && <Boton onClick={() => setMoviendo(true)}>Registrar movimiento</Boton>}
      </header>

      <Tarjeta>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Existencia" valor={cantidad(i.existencia)} unidad={i.unidadMedida} destacado />
          <Dato etiqueta="Tipo" valor={NOMBRE_TIPO_ITEM[i.tipo]} />
          <Dato etiqueta="Movimientos mostrados" valor={kardex.data?.length ?? 0} nota="Los 200 más recientes" />
        </dl>
      </Tarjeta>

      {kardex.isError && <Alerta tipo="error">{comoErrorApi(kardex.error).mensaje}</Alerta>}

      <Tarjeta titulo="Kardex" sinRelleno>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
              <tr>
                <th className="px-4 py-2">Fecha y hora</th>
                <th className="px-4 py-2">Día op.</th>
                <th className="px-4 py-2">Turno</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2 text-right">Cantidad</th>
                <th className="px-4 py-2 text-right">Saldo</th>
                <th className="px-4 py-2">Registró</th>
                <th className="px-4 py-2">Referencia · observación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {kardex.data?.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{fechaHora(m.fechaHoraRegistro)}</td>
                  <td className="px-4 py-2 cifra">{fechaCorta(m.fechaOperativa)}</td>
                  <td className="px-4 py-2">{turno(m.turnoId)}</td>
                  <td className="px-4 py-2"><Badge tono={TONO_MOVIMIENTO[m.tipo]}>{m.tipo}</Badge></td>
                  <td className={`px-4 py-2 text-right cifra font-semibold ${m.cantidad < 0 ? 'text-critico' : 'text-exito'}`}>
                    {m.cantidad > 0 ? '+' : ''}{cantidad(m.cantidad)}
                  </td>
                  <td className="px-4 py-2 text-right cifra">{cantidad(m.saldo)}</td>
                  <td className="px-4 py-2">{m.usuarioNombre}</td>
                  <td className="px-4 py-2 text-tinta-suave">
                    {m.entradaId ? (
                      <Link to={`/inventario/entradas/${m.entradaId}`} className="text-marca hover:underline">{m.referencia ?? 'Entrada'}</Link>
                    ) : m.remisionId ? (
                      // Consumo por receta al aprobar la remisión.
                      <Link to={`/remisiones/${m.remisionId}`} className="text-marca hover:underline">{m.referencia ?? 'Remisión'}</Link>
                    ) : null}
                    {' '}
                    {[m.entradaId || m.remisionId ? null : m.referencia, m.conteoTexto, m.motivo && `Motivo: ${m.motivo}`, m.observacion].filter(Boolean).join(' · ') ||
                      (m.entradaId || m.remisionId ? null : '—')}
                  </td>
                </tr>
              ))}
              {kardex.data?.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-tinta-suave">Sin movimientos todavía.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {moviendo && <MovimientoDialogo item={i} onCerrar={() => setMoviendo(false)} />}
    </section>
  )
}
