/**
 * KARDEX DE UN ÍTEM
 * =================
 *
 * Todos los movimientos del ítem, del más reciente al más antiguo, con
 * el saldo que dejó cada uno. Es la trazabilidad: si la existencia no
 * cuadra, aquí se ve qué movimiento la descuadró y quién lo registró.
 *
 * Rediseño (usuario, 2026-10-05: fuera las tarjetas, la tabla de 8
 * columnas se veía saturada): línea de tiempo agrupada por día operativo.
 * Cada movimiento muestra la cantidad grande (verde si entra, roja si
 * sale) y el saldo que dejó; quién, turno y referencia van en pequeño.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Dato } from '../../../components/Dato'
import { EncabezadoDetalle } from '../../../components/EncabezadoDetalle'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { Ficha } from '../../../components/Ficha'
import { IconoReloj } from '../../../components/Iconos'
import { LineaTiempo, type GrupoTiempo } from '../../../components/LineaTiempo'
import { MetaDato } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import { comoErrorApi } from '../../../services/http'
import { NOMBRE_TIPO_ITEM, type MovimientoInventario } from '../../../shared/types/inventario'
import { agruparEnOrden } from '../../../shared/utils/agrupar'
import { diaLargo, hora } from '../../../shared/utils/fechas'
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

  if (item.isLoading) return <PantallaCargando forma="detalle" />
  if (!item.data) return <Alerta tipo="error">{item.error ? comoErrorApi(item.error).mensaje : 'No se encontró el ítem.'}</Alerta>
  const i = item.data
  const turno = (tid: string) => turnos.data?.find((t) => t.id === tid)?.codigo ?? '—'
  const movimientos = kardex.data ?? []
  const entradas = movimientos.filter((m) => m.cantidad > 0).reduce((s, m) => s + m.cantidad, 0)
  const salidas = movimientos.filter((m) => m.cantidad < 0).reduce((s, m) => s + m.cantidad, 0)

  const grupos: GrupoTiempo[] = agruparEnOrden(movimientos, (m) => m.fechaOperativa.slice(0, 10)).map((g): GrupoTiempo => {
    const neto = g.elementos.reduce((s, m) => s + m.cantidad, 0)
    return {
      clave: g.clave,
      titulo: diaLargo(g.clave),
      resumen: `${g.elementos.length} ${g.elementos.length === 1 ? 'movimiento' : 'movimientos'} · neto ${neto > 0 ? '+' : ''}${cantidad(neto)} ${i.unidadMedida}`,
      eventos: g.elementos.map((m) => ({
        clave: m.id,
        tono: m.cantidad < 0 ? 'critico' : 'exito',
        contenido: <Movimiento m={m} turno={turno(m.turnoId)} unidad={i.unidadMedida} />,
      })),
    }
  })

  return (
    <section className="space-y-6">
      <EncabezadoDetalle
        volver={{ a: '/inventario', texto: 'Existencias' }}
        insignias={
          <>
            <Badge tono={TONO_TIPO[i.tipo]}>{NOMBRE_TIPO_ITEM[i.tipo]}</Badge>
            {!i.activo && <Badge tono="neutro">Inactivo</Badge>}
          </>
        }
        codigo={i.codigo}
        titulo={i.descripcion}
        cifra={{ etiqueta: 'Existencia', valor: cantidad(i.existencia), unidad: i.unidadMedida }}
        acciones={
          tienePermiso('inventario.registrar') &&
          i.activo && <Boton onClick={() => setMoviendo(true)}>Registrar movimiento</Boton>
        }
      />

      <Ficha>
        <Dato etiqueta="Movimientos mostrados" valor={movimientos.length} nota="Los 200 más recientes" />
        <Dato etiqueta="Entró en ese periodo" valor={`+${cantidad(entradas)}`} unidad={i.unidadMedida} />
        <Dato etiqueta="Salió en ese periodo" valor={cantidad(salidas)} unidad={i.unidadMedida} />
      </Ficha>

      {kardex.isError && <Alerta tipo="error">{comoErrorApi(kardex.error).mensaje}</Alerta>}

      <Seccion titulo="Kardex" descripcion="Del más reciente al más antiguo. Verde: entró; rojo: salió. A la derecha, el saldo que dejó cada movimiento.">
        {kardex.isLoading ? (
          <PantallaCargando />
        ) : movimientos.length === 0 ? (
          <EstadoVacio Icono={IconoReloj} titulo="Sin movimientos todavía" texto="Cuando se registre una entrada, una salida o un ajuste, aparecerá aquí." />
        ) : (
          <LineaTiempo grupos={grupos} />
        )}
      </Seccion>

      {moviendo && <MovimientoDialogo item={i} onCerrar={() => setMoviendo(false)} />}
    </section>
  )
}

/** Un movimiento en la línea de tiempo: qué fue, quién, cuánto y el saldo que dejó. */
function Movimiento({ m, turno, unidad }: { m: MovimientoInventario; turno: string; unidad: string }) {
  const extra = [m.entradaId || m.remisionId ? null : m.referencia, m.conteoTexto, m.motivo && `Motivo: ${m.motivo}`, m.observacion]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tono={TONO_MOVIMIENTO[m.tipo]}>{m.tipo}</Badge>
          <span className="cifra text-sm font-bold text-tinta">{hora(m.fechaHoraRegistro)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
          <MetaDato etiqueta="Turno">{turno}</MetaDato>
          <MetaDato etiqueta="Registró">{m.usuarioNombre}</MetaDato>
          {m.entradaId && (
            <Link to={`/inventario/entradas/${m.entradaId}`} className="font-semibold text-marca hover:underline">
              {m.referencia ?? 'Entrada'} →
            </Link>
          )}
          {m.remisionId && (
            // Consumo por receta al aprobar la remisión.
            <Link to={`/remisiones/${m.remisionId}`} className="font-semibold text-marca hover:underline">
              {m.referencia ?? 'Remisión'} →
            </Link>
          )}
        </div>
        {extra && <p className="mt-1.5 text-sm text-tinta-suave">{extra}</p>}
      </div>
      <div className="text-right">
        <p className={`cifra text-xl font-black leading-none ${m.cantidad < 0 ? 'text-critico' : 'text-exito'}`}>
          {m.cantidad > 0 ? '+' : ''}
          {cantidad(m.cantidad)}
          <span className="ml-1 text-xs font-semibold text-tinta-suave">{unidad}</span>
        </p>
        <p className="mt-1 text-xs text-tinta-suave">
          saldo <span className="cifra font-bold text-tinta">{cantidad(m.saldo)}</span>
        </p>
      </div>
    </div>
  )
}
