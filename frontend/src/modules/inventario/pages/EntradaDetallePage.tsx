/**
 * Detalle de una entrada de mercancía: encabezado y sus líneas (con enlace al kardex de cada ítem).
 *
 * Rediseño (usuario, 2026-10-05: fuera las tarjetas): los datos del
 * documento en una ficha abierta y cada línea como fila con la cantidad
 * que entró en grande.
 */

import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Dato } from '../../../components/Dato'
import { EncabezadoDetalle } from '../../../components/EncabezadoDetalle'
import { Ficha } from '../../../components/Ficha'
import { FilaRegistro, ListaRegistros } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
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
    <section className="space-y-6">
      <EncabezadoDetalle
        volver={{ a: '/inventario/entradas', texto: 'Entradas' }}
        codigo="Entrada de mercancía"
        titulo={e.documento}
        cifra={{ etiqueta: 'Líneas', valor: e.lineas.length }}
      />

      <Ficha>
        <Dato etiqueta="Fecha y hora" valor={fechaHora(e.fechaHoraRegistro)} />
        <Dato etiqueta="Día operativo" valor={fechaCorta(e.fechaOperativa)} />
        <Dato etiqueta="Turno" valor={turnos.data?.find((t) => t.id === e.turnoId)?.codigo ?? '—'} />
        <Dato etiqueta="Quién entrega" valor={e.remitente ?? '—'} />
        <Dato etiqueta="Recibió" valor={e.usuarioNombre} />
      </Ficha>
      {e.observacion && (
        <p className="text-sm text-tinta-suave">
          <span className="font-semibold text-tinta">Observación:</span> {e.observacion}
        </p>
      )}

      <Seccion titulo="Lo que entró" contador={e.lineas.length} tono="exito">
        <ListaRegistros>
          {e.lineas.map((l) => (
            <FilaRegistro
              key={l.movimientoId}
              tono="exito"
              titulo={l.descripcion}
              detalle={
                <Link to={`/inventario/${l.itemId}`} className="cifra font-semibold text-marca hover:underline">
                  {l.codigo} · ver kardex →
                </Link>
              }
              // Lo que se digitó, con la equivalencia usada.
              meta={l.conteoTexto && <span>{l.conteoTexto}</span>}
              cifra={`+${cantidad(l.cantidad)}`}
              unidad={l.unidadMedida}
              colorCifra="text-exito"
              notaCifra={
                <>
                  saldo después <span className="cifra font-bold text-tinta">{cantidad(l.saldo)}</span>
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>
    </section>
  )
}
