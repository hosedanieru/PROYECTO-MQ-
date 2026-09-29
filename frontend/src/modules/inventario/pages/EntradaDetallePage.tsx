/** Detalle de una entrada de mercancía: encabezado y sus líneas (con enlace al kardex de cada ítem). */

import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Dato } from '../../../components/Dato'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Tarjeta } from '../../../components/Tarjeta'
import { comoErrorApi } from '../../../services/http'
import { fechaCorta, fechaHora } from '../../../shared/utils/fechas'
import { cantidad } from '../../../shared/utils/numeros'
import { useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useEntrada } from '../hooks/useInventario'

export function EntradaDetallePage() {
  const { id = '' } = useParams()
  const entrada = useEntrada(id)
  const turnos = useTurnos()

  if (entrada.isLoading) return <PantallaCargando />
  if (!entrada.data) return <Alerta tipo="error">{entrada.error ? comoErrorApi(entrada.error).mensaje : 'No se encontró la entrada.'}</Alerta>
  const e = entrada.data

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <Link to="/inventario/entradas" className="text-sm text-marca hover:underline">← Entradas</Link>
        <h1 className="mt-1 text-2xl font-semibold text-tinta">Entrada · {e.documento}</h1>
      </header>

      <Tarjeta>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Fecha y hora" valor={fechaHora(e.fechaHoraRegistro)} />
          <Dato etiqueta="Día operativo" valor={fechaCorta(e.fechaOperativa)} />
          <Dato etiqueta="Turno" valor={turnos.data?.find((t) => t.id === e.turnoId)?.codigo ?? '—'} />
          <Dato etiqueta="Documento de soporte" valor={e.documento} />
          <Dato etiqueta="Quién entrega" valor={e.remitente ?? '—'} />
          <Dato etiqueta="Recibió" valor={e.usuarioNombre} />
        </dl>
        {e.observacion && <p className="mt-4 text-sm text-tinta-suave">Observación: {e.observacion}</p>}
      </Tarjeta>

      <Tarjeta titulo={`Líneas (${e.lineas.length})`} sinRelleno>
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-5 py-2">Ítem</th>
              <th className="px-5 py-2 text-right">Cantidad</th>
              <th className="px-5 py-2 text-right" title="Existencia que quedó después de esta entrada">Saldo después</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {e.lineas.map((l) => (
              <tr key={l.movimientoId}>
                <td className="px-5 py-2">
                  <Link to={`/inventario/${l.itemId}`} className="cifra text-marca hover:underline">{l.codigo}</Link>{' '}
                  <span className="text-tinta-suave">{l.descripcion}</span>
                </td>
                <td className="px-5 py-2 text-right cifra font-semibold text-exito">+{cantidad(l.cantidad)} {l.unidadMedida}</td>
                <td className="px-5 py-2 text-right cifra">{cantidad(l.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </section>
  )
}
