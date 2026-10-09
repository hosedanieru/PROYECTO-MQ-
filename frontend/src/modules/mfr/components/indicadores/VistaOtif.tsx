import { Badge } from '../../../../components/Badge'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../../components/ListaRegistros'
import { Seccion } from '../../../../components/Seccion'
import type { IndicadoresPeriodo, SkuOtif } from '../../../../shared/types/mfr'
import { fechaCorta, hora } from '../../../../shared/utils/fechas'
import { miles, porcentaje } from '../../../../shared/utils/numeros'
import { Marcador } from './Marcador'

function estadoSku(s: SkuOtif): { texto: string; tono: 'exito' | 'alerta' | 'critico' } {
  if (s.aTiempo) return { texto: 'A tiempo y completo', tono: 'exito' }
  if (s.completo) return { texto: s.sinFechaAprobacion ? 'Completo, sin hora de aprobación' : 'Completo, pero tarde', tono: 'alerta' }
  return { texto: 'Incompleto', tono: 'critico' }
}

/**
 * OTIF (A TIEMPO Y COMPLETO)
 * ==========================
 *
 * Por PT del DPP y día: completo si lo aprobado alcanza su T; a tiempo si
 * lo alcanzó antes del fin de su último bloque (usuario, 2026-10-06).
 * Abajo, cada PT: lo que no cumplió va primero y dice por qué.
 */
export function VistaOtif({ datos }: { datos: IndicadoresPeriodo }) {
  const { otif } = datos
  const nombre = (id: string) => datos.productos[id]?.nombre ?? id
  const codigo = (id: string) => datos.productos[id]?.codigo ?? id
  const detalle = [...otif.detalle].sort((a, b) => Number(a.aTiempo) - Number(b.aTiempo) || Number(a.completo) - Number(b.completo))
  const tarde = otif.completos - otif.cumplen

  return (
    <div className="space-y-8">
      <div className="grid gap-x-10 gap-y-6 border-b border-borde pb-6 sm:grid-cols-2 lg:grid-cols-3">
        <Marcador
          titulo="OTIF"
          valor={porcentaje(otif.porcentaje)}
          detalle={`${otif.cumplen} de ${otif.skus} PT se aprobaron completos antes de terminar su último bloque.`}
        />
        <Marcador titulo="Completos (In Full)" valor={porcentaje(otif.completosPorcentaje)} detalle={`${otif.completos} de ${otif.skus} PT llegaron a lo programado.`} />
        <Marcador
          titulo="Completos, pero tarde"
          valor={String(tarde)}
          color={tarde > 0 ? 'text-alerta' : 'text-tinta'}
          detalle="PT que se completaron después de su hora límite."
        />
      </div>

      <Seccion
        titulo="Cada PT"
        contador={otif.skus}
        descripcion="Primero lo que no cumplió. La hora límite es el fin del último bloque del PT ese día."
        tono={otif.cumplen === otif.skus ? 'exito' : 'alerta'}
      >
        <ListaRegistros estaVacia={otif.skus === 0} vacio={<p className="py-6 text-sm text-tinta-suave">No hay PT programados en el periodo.</p>}>
          {detalle.map((s) => {
            const estado = estadoSku(s)
            return (
              <FilaRegistro
                key={`${s.fechaOperativa}-${s.productoId}`}
                tono={estado.tono}
                etiqueta={<Badge tono={estado.tono}>{estado.texto}</Badge>}
                titulo={nombre(s.productoId)}
                detalle={
                  <>
                    <span className="cifra">{codigo(s.productoId)}</span> · día {fechaCorta(s.fechaOperativa)}
                  </>
                }
                meta={
                  <>
                    <MetaDato etiqueta="Hora límite">{hora(s.limite)}</MetaDato>
                    <MetaDato etiqueta="Se completó">{s.completoEn ? hora(s.completoEn) : '—'}</MetaDato>
                  </>
                }
                cifra={miles(s.aprobadoCajas)}
                unidad={`de ${miles(s.programadoCajas)}`}
                colorCifra={s.completo ? 'text-tinta' : 'text-critico'}
                notaCifra="cajas aprobadas"
              />
            )
          })}
        </ListaRegistros>
      </Seccion>
    </div>
  )
}
