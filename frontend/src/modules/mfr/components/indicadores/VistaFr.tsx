import { Barras } from '../../../../components/graficas/Barras'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../../components/ListaRegistros'
import { Seccion } from '../../../../components/Seccion'
import type { IndicadoresPeriodo } from '../../../../shared/types/mfr'
import { fechaCorta } from '../../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../../shared/utils/numeros'
import { Marcador } from './Marcador'

/**
 * FR (FILL RATE)
 * ==============
 *
 * Total aprobado ÷ total programado, SIN tope por SKU: lo que sobra en un
 * PT compensa lo que falta en otro (el pedido es el DPP; usuario,
 * 2026-10-06). El MFR, en cambio, sí topa por PT.
 */
export function VistaFr({ datos }: { datos: IndicadoresPeriodo }) {
  const { fr } = datos
  const faltan = Math.max(0, fr.programadoCajas - fr.aprobadoCajas)

  return (
    <div className="space-y-8">
      <div className="grid gap-x-10 gap-y-6 border-b border-borde pb-6 sm:grid-cols-2 lg:grid-cols-3">
        <Marcador
          titulo="FR del periodo"
          valor={porcentaje(fr.porcentaje)}
          detalle="Lo que sobra en un PT compensa lo que falta en otro."
        />
        <Marcador titulo="Aprobado" valor={miles(fr.aprobadoCajas)} detalle={`de ${miles(fr.programadoCajas)} cajas programadas en el DPP`} />
        <Marcador
          titulo={faltan > 0 ? 'Faltan' : 'Sobran'}
          valor={miles(faltan > 0 ? faltan : fr.aprobadoCajas - fr.programadoCajas)}
          color={faltan > 0 ? 'text-critico' : 'text-exito'}
          detalle="cajas frente al total programado"
        />
      </div>

      {fr.porDia.length > 1 && (
        <Seccion titulo="FR por día" descripcion="Total aprobado ÷ total programado de cada día operativo.">
          <Barras
            datos={fr.porDia.map((d) => ({
              clave: d.fechaOperativa,
              etiqueta: fechaCorta(d.fechaOperativa).slice(0, 5),
              valor: d.porcentaje === null ? null : Math.round(d.porcentaje),
              detalle: `${miles(d.aprobadoCajas)} de ${miles(d.programadoCajas)} cajas`,
            }))}
            maximo={Math.max(100, ...fr.porDia.map((d) => d.porcentaje ?? 0))}
            sufijo="%"
          />
        </Seccion>
      )}

      <Seccion titulo="Día por día" contador={fr.porDia.length}>
        <ListaRegistros estaVacia={fr.porDia.length === 0} vacio={<p className="py-6 text-sm text-tinta-suave">Sin programación ni producción en el periodo.</p>}>
          {fr.porDia.map((d) => (
            <FilaRegistro
              key={d.fechaOperativa}
              tono={d.porcentaje === null ? 'neutro' : d.porcentaje >= 100 ? 'exito' : 'alerta'}
              titulo={fechaCorta(d.fechaOperativa)}
              meta={
                <>
                  <MetaDato etiqueta="Aprobado">{miles(d.aprobadoCajas)}</MetaDato>
                  <MetaDato etiqueta="Programado">{miles(d.programadoCajas)}</MetaDato>
                </>
              }
              cifra={porcentaje(d.porcentaje, 'sin DPP')}
            />
          ))}
        </ListaRegistros>
      </Seccion>
    </div>
  )
}
