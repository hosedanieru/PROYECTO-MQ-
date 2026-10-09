import { Alerta } from '../../../../components/Alerta'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../../components/ListaRegistros'
import { Seccion } from '../../../../components/Seccion'
import type { IndicadoresPeriodo, MedidaProductividad } from '../../../../shared/types/mfr'
import { miles } from '../../../../shared/utils/numeros'
import { cajasPorPersonaHora } from './formatos'

function Filas({ titulo, filas }: { titulo: string; filas: Array<MedidaProductividad & { clave: string; nombre: string }> }) {
  return (
    <Seccion titulo={titulo} contador={filas.length}>
      <ListaRegistros estaVacia={filas.length === 0} vacio={<p className="py-6 text-sm text-tinta-suave">Sin asistencia registrada en el periodo.</p>}>
        {filas.map((f) => (
          <FilaRegistro
            key={f.clave}
            tono="marca"
            titulo={f.nombre}
            meta={
              <>
                <MetaDato etiqueta="Cajas">{miles(f.cajas)}</MetaDato>
                <MetaDato etiqueta="Personas">{miles(f.personas)}</MetaDato>
                <MetaDato etiqueta="Horas-persona">{miles(f.horasPersona)}</MetaDato>
              </>
            }
            cifra={cajasPorPersonaHora(f.cajasPorPersonaHora)}
            notaCifra="cajas por persona-hora"
          />
        ))}
      </ListaRegistros>
    </Seccion>
  )
}

/**
 * PRODUCTIVIDAD
 * =============
 *
 * Cajas aprobadas ÷ (personas que llegaron × horas del turno). Las 7,5 h
 * del turno son productivas. Sin meta todavía: la define el área y la
 * configurará el administrador; hasta entonces no hay semáforo.
 */
export function VistaProductividad({ datos }: { datos: IndicadoresPeriodo }) {
  const p = datos.productividad

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-x-10 gap-y-3 border-b border-borde pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">Cajas por persona-hora</p>
          <p className="cifra mt-1 text-5xl font-black leading-none tracking-tight text-tinta">{cajasPorPersonaHora(p.total.cajasPorPersonaHora)}</p>
        </div>
        <p className="max-w-lg pb-1 text-sm text-tinta-suave">
          <span className="cifra font-bold text-tinta">{miles(p.total.cajas)}</span> cajas aprobadas ÷{' '}
          <span className="cifra font-bold text-tinta">{miles(p.total.horasPersona)}</span> horas-persona ({miles(p.total.personas)} personas ×
          las horas de su turno). <span className="font-semibold text-tinta">Sin meta todavía:</span> la define el área.
        </p>
      </div>

      {p.cajasSinAsistencia > 0 && (
        <Alerta tipo="advertencia">
          {miles(p.cajasSinAsistencia)} cajas aprobadas son de turnos sin asistencia registrada y no entran en la productividad (no se puede
          dividir por cero personas). Registre el personal en la Programación del día.
        </Alerta>
      )}

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <Filas titulo="Por turno" filas={p.porTurno.map((t) => ({ ...t, clave: t.turnoId, nombre: datos.turnos[t.turnoId]?.nombre ?? t.turnoId }))} />
        <Filas
          titulo="Por grupo (proveedor)"
          filas={p.porGrupo.map((g) => ({ ...g, clave: g.grupoId, nombre: datos.grupos[g.grupoId]?.nombre ?? g.grupoId }))}
        />
      </div>
    </div>
  )
}
