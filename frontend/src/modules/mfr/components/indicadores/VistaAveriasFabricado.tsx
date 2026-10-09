import { Link, useLocation } from 'react-router-dom'

import { Alerta } from '../../../../components/Alerta'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../../components/ListaRegistros'
import { Seccion } from '../../../../components/Seccion'
import type { IndicadoresPeriodo, MedidaFabricado } from '../../../../shared/types/mfr'
import { fechaCorta } from '../../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../../shared/utils/numeros'
import { BarraFabricado, LeyendaFabricado } from './BarraFabricado'

const pct = (m: MedidaFabricado) => porcentaje(m.porcentaje, '—', 2)

function Filas({ filas, titulo }: { filas: Array<MedidaFabricado & { clave: string; nombre: string; detalle?: string }>; titulo: string }) {
  return (
    <Seccion titulo={titulo} contador={filas.length}>
      <ListaRegistros estaVacia={filas.length === 0} vacio={<p className="py-6 text-sm text-tinta-suave">Sin datos en el periodo.</p>}>
        {filas.map((f) => (
          <FilaRegistro
            key={f.clave}
            tono={f.averiadasUnidades > 0 ? 'alerta' : 'exito'}
            titulo={f.nombre}
            detalle={f.detalle}
            meta={
              <>
                <MetaDato etiqueta="Averiadas">{miles(f.averiadasUnidades)}</MetaDato>
                <MetaDato etiqueta="Fabricadas">{miles(f.fabricadoUnidades)}</MetaDato>
                {f.extraoficialUnidades > 0 && (
                  <MetaDato etiqueta="de ellas extraoficiales">{miles(f.extraoficialUnidades)}</MetaDato>
                )}
              </>
            }
            pie={<BarraFabricado medida={f} />}
            cifra={pct(f)}
            notaCifra="de lo que pasó por la línea"
          />
        ))}
      </ListaRegistros>
    </Seccion>
  )
}

/**
 * AVERÍAS VS LO FABRICADO
 * =======================
 *
 * Unidades averiadas ÷ (fabricadas + averiadas): qué parte de todo lo que
 * pasó por la línea salió mala (usuario, 2026-10-06). Es distinto del %
 * contra el DPP con el límite del 1 % del contrato, que sigue en Averías.
 * Las extraoficiales cuentan como fabricadas, pero van con su propio
 * color en la barra (usuario, 2026-10-07).
 */
export function VistaAveriasFabricado({ datos }: { datos: IndicadoresPeriodo }) {
  const a = datos.averiasVsFabricado
  const turno = (id: string) => datos.turnos[id]?.nombre ?? id
  const { search } = useLocation()

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b border-borde pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Averías vs lo fabricado</p>
          <p className="cifra mt-1 text-5xl font-black leading-none tracking-tight text-tinta">{pct(a.total)}</p>
        </div>
        <p className="max-w-lg pb-1 text-sm text-tinta-suave">
          <span className="cifra font-bold text-tinta">{miles(a.total.averiadasUnidades)}</span> unidades averiadas de{' '}
          <span className="cifra font-bold text-tinta">{miles(a.total.fabricadoUnidades + a.total.averiadasUnidades)}</span> que pasaron por
          la línea. El límite del 1 % del contrato se mide contra el DPP:{' '}
          {/* Mismo periodo: se lleva la consulta de la URL (?periodo=&fecha=) al otro tablero. */}
          <Link to={`/tableros/averias-limite${search}`} className="font-semibold text-marca hover:underline">
            ver el indicador del 1 % →
          </Link>
        </p>
        <div className="w-full space-y-3">
          <BarraFabricado medida={a.total} grande />
          <LeyendaFabricado medida={a.total} />
        </div>
      </div>

      {a.bolsasSinConvertir > 0 && (
        <Alerta tipo="advertencia">
          {a.bolsasSinConvertir} bolsa(s) averiada(s) no suman: falta definir su equivalencia en unidades.
        </Alerta>
      )}

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Filas
          titulo="Por turno"
          filas={a.porTurno.map((t) => ({ ...t, clave: t.turnoId, nombre: turno(t.turnoId) }))}
        />
        <Filas
          titulo="Por día operativo"
          filas={a.porDia.map((d) => ({ ...d, clave: d.fechaOperativa, nombre: fechaCorta(d.fechaOperativa) }))}
        />
      </div>
      <Filas
        titulo="Por PT (los que tuvieron averías)"
        filas={a.porProducto.map((p) => ({
          ...p,
          clave: p.productoId,
          nombre: datos.productos[p.productoId]?.nombre ?? p.productoId,
          detalle: datos.productos[p.productoId]?.codigo,
        }))}
      />
    </div>
  )
}
