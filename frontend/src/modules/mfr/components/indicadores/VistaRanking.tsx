import { BarraProporcion } from '../../../../components/BarraProporcion'
import { FilaRegistro, ListaRegistros } from '../../../../components/ListaRegistros'
import { Seccion } from '../../../../components/Seccion'
import type { FilaRanking, IndicadoresPeriodo } from '../../../../shared/types/mfr'
import { miles, porcentaje } from '../../../../shared/utils/numeros'

/** Uno de los dos extremos, destacado arriba. */
function Extremo({ titulo, fila, nombre, codigo, tono }: { titulo: string; fila: FilaRanking | null; nombre: string; codigo: string; tono: 'exito' | 'critico' }) {
  return (
    <div className={`border-l-4 py-1 pl-5 ${tono === 'exito' ? 'border-l-exito' : 'border-l-critico'}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-tinta-suave">{titulo}</p>
      {fila ? (
        <>
          <p className="mt-1 text-lg font-black leading-snug text-tinta">{nombre}</p>
          <p className="cifra text-sm text-tinta-suave">{codigo}</p>
          <p className="mt-2">
            <span className="cifra text-4xl font-black leading-none text-tinta">{miles(fila.producidoCajas)}</span>
            <span className="ml-1.5 text-sm text-tinta-suave">
              cajas{fila.programado ? ` de ${miles(fila.programadoCajas)} programadas (${porcentaje(fila.cumplimiento)})` : ''}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-tinta-suave">Sin datos en el periodo.</p>
      )}
    </div>
  )
}

/**
 * PT CON MÁS Y MENOS PRODUCCIÓN
 * =============================
 *
 * Cajas aprobadas por PT en el periodo. El de menos se busca entre TODOS
 * los programados, incluidos los que sacaron 0 (usuario, 2026-10-06):
 * así un PT que no arrancó salta a la vista.
 */
export function VistaRanking({ datos }: { datos: IndicadoresPeriodo }) {
  const { ranking } = datos
  const nombre = (id: string) => datos.productos[id]?.nombre ?? id
  const codigo = (id: string) => datos.productos[id]?.codigo ?? id

  return (
    <div className="space-y-8">
      <div className="grid gap-x-10 gap-y-6 border-b border-borde pb-6 md:grid-cols-2">
        <Extremo
          titulo="Más producción"
          fila={ranking.mayor}
          nombre={ranking.mayor ? nombre(ranking.mayor.productoId) : ''}
          codigo={ranking.mayor ? codigo(ranking.mayor.productoId) : ''}
          tono="exito"
        />
        <Extremo
          titulo="Menos producción (entre los programados)"
          fila={ranking.menor}
          nombre={ranking.menor ? nombre(ranking.menor.productoId) : ''}
          codigo={ranking.menor ? codigo(ranking.menor.productoId) : ''}
          tono="critico"
        />
      </div>

      <Seccion titulo="Todos los PT, de más a menos" contador={ranking.filas.length} descripcion="La barra es lo producido frente a lo programado en el periodo.">
        <ListaRegistros estaVacia={ranking.filas.length === 0} vacio={<p className="py-6 text-sm text-tinta-suave">Sin producción ni programación en el periodo.</p>}>
          {ranking.filas.map((f, i) => (
            <FilaRegistro
              key={f.productoId}
              tono={!f.programado ? 'neutro' : f.producidoCajas === 0 ? 'critico' : 'marca'}
              etiqueta={
                <span className="cifra grid h-8 min-w-8 place-items-center rounded-full bg-velo px-2 text-sm font-black text-tinta">{i + 1}</span>
              }
              titulo={nombre(f.productoId)}
              detalle={<span className="cifra">{codigo(f.productoId)}</span>}
              pie={
                f.programado && (
                  <BarraProporcion
                    valor={f.producidoCajas}
                    total={f.programadoCajas}
                    tono={f.producidoCajas === 0 ? 'critico' : 'marca'}
                    descripcion={`${miles(f.producidoCajas)} de ${miles(f.programadoCajas)} cajas programadas`}
                  />
                )
              }
              cifra={miles(f.producidoCajas)}
              unidad="cajas"
              colorCifra={f.programado && f.producidoCajas === 0 ? 'text-critico' : 'text-tinta'}
              notaCifra={f.programado ? `de ${miles(f.programadoCajas)} · ${porcentaje(f.cumplimiento)}` : 'sin programación'}
            />
          ))}
        </ListaRegistros>
      </Seccion>
    </div>
  )
}
