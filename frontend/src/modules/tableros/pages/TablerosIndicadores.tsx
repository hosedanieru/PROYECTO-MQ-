/**
 * TABLEROS DE INDICADORES — uno por indicador (usuario, 2026-10-06)
 * ================================================================
 *
 *   /tableros/fr                 FR (aprobado ÷ programado, sin tope por PT)
 *   /tableros/otif               OTIF (a tiempo y completo, por PT)
 *   /tableros/pt                 PT con más y menos producción
 *   /tableros/productividad      cajas por persona-hora, por turno y grupo
 *   /tableros/averias-fabricado  averías ÷ (fabricado + averiado)
 *
 * Cada uno es una pantalla corta: qué cifras van en la banda y qué vista
 * va debajo. El molde (`TableroConIndicadores`) pone el periodo y la consulta.
 */

import { CifraEstado } from '../../../components/CifraEstado'
import { IconoAveria, IconoCaja, IconoIndicadores, IconoPersonas, IconoRemision } from '../../../components/Iconos'
import { cajasPorPersonaHora, unDecimal } from '../../mfr/components/indicadores/formatos'
import { VistaAveriasFabricado } from '../../mfr/components/indicadores/VistaAveriasFabricado'
import { VistaFr } from '../../mfr/components/indicadores/VistaFr'
import { VistaOtif } from '../../mfr/components/indicadores/VistaOtif'
import { VistaProductividad } from '../../mfr/components/indicadores/VistaProductividad'
import { VistaRanking } from '../../mfr/components/indicadores/VistaRanking'
import { TableroConIndicadores } from '../TableroConIndicadores'

const dosDecimales = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function TableroFrPage() {
  return (
    <TableroConIndicadores
      titulo="FR · Fill Rate"
      queMide="Total aprobado frente a lo programado en el DPP."
      Icono={IconoIndicadores}
      cifras={(d) => (
        <>
          <CifraEstado variante="vidrio" etiqueta="FR (%)" valor={d?.fr.porcentaje ?? null} total={100} tono="marca" formato={unDecimal} />
          <CifraEstado variante="vidrio" etiqueta="Aprobado" detalle="cajas" valor={d?.fr.aprobadoCajas ?? null} tono="exito" />
          <CifraEstado variante="vidrio" etiqueta="Programado" detalle="cajas en el DPP" valor={d?.fr.programadoCajas ?? null} tono="neutro" />
          <CifraEstado variante="vidrio" etiqueta="Días" detalle="con programación o producción" valor={d?.fr.porDia.length ?? null} tono="acento" />
        </>
      )}
    >
      {(d) => <VistaFr datos={d} />}
    </TableroConIndicadores>
  )
}

export function TableroOtifPage() {
  return (
    <TableroConIndicadores
      titulo="OTIF · A tiempo y completo"
      queMide="PT del DPP aprobados completos antes del fin de su último bloque."
      Icono={IconoRemision}
      cifras={(d) => (
        <>
          <CifraEstado variante="vidrio" etiqueta="OTIF (%)" valor={d?.otif.porcentaje ?? null} total={100} tono="marca" formato={unDecimal} />
          <CifraEstado variante="vidrio" etiqueta="Completos (%)" valor={d?.otif.completosPorcentaje ?? null} total={100} tono="exito" formato={unDecimal} />
          <CifraEstado variante="vidrio" etiqueta="Cumplen" detalle="a tiempo y completos" valor={d?.otif.cumplen ?? null} total={d?.otif.skus} tono="exito" />
          <CifraEstado variante="vidrio" etiqueta="PT programados" valor={d?.otif.skus ?? null} tono="neutro" />
        </>
      )}
    >
      {(d) => <VistaOtif datos={d} />}
    </TableroConIndicadores>
  )
}

export function TableroPtPage() {
  return (
    <TableroConIndicadores
      titulo="Producción por PT"
      queMide="El PT con más y el de menos producción, entre todos los programados."
      Icono={IconoCaja}
      escena="empaque"
      cifras={(d) => (
        <>
          <CifraEstado
            variante="vidrio"
            etiqueta="Producido"
            detalle="cajas aprobadas"
            valor={d ? d.ranking.filas.reduce((s, f) => s + f.producidoCajas, 0) : null}
            tono="exito"
          />
          <CifraEstado variante="vidrio" etiqueta="PT programados" valor={d ? d.ranking.filas.filter((f) => f.programado).length : null} tono="neutro" />
          <CifraEstado
            variante="vidrio"
            etiqueta="PT en cero"
            detalle="programados sin producción"
            valor={d ? d.ranking.filas.filter((f) => f.programado && f.producidoCajas === 0).length : null}
            tono="critico"
          />
          <CifraEstado variante="vidrio" etiqueta="El de más" detalle="cajas" valor={d?.ranking.mayor?.producidoCajas ?? null} tono="marca" />
        </>
      )}
    >
      {(d) => <VistaRanking datos={d} />}
    </TableroConIndicadores>
  )
}

export function TableroProductividadPage() {
  return (
    <TableroConIndicadores
      titulo="Productividad"
      queMide="Cajas aprobadas por cada persona-hora (las 7,5 h del turno son productivas)."
      Icono={IconoPersonas}
      escena="personas"
      cifras={(d) => (
        <>
          <CifraEstado
            variante="vidrio"
            etiqueta="Cajas por persona-hora"
            valor={d?.productividad.total.cajasPorPersonaHora ?? null}
            tono="acento"
            formato={(n) => cajasPorPersonaHora(n)}
          />
          <CifraEstado variante="vidrio" etiqueta="Cajas" detalle="de turnos con asistencia" valor={d?.productividad.total.cajas ?? null} tono="exito" />
          <CifraEstado variante="vidrio" etiqueta="Personas" detalle="que llegaron" valor={d?.productividad.total.personas ?? null} tono="marca" />
          <CifraEstado variante="vidrio" etiqueta="Horas-persona" valor={d?.productividad.total.horasPersona ?? null} tono="neutro" />
        </>
      )}
    >
      {(d) => <VistaProductividad datos={d} />}
    </TableroConIndicadores>
  )
}

export function TableroAveriasFabricadoPage() {
  return (
    <TableroConIndicadores
      titulo="Averías vs lo fabricado"
      queMide="Qué parte de todo lo que pasó por la línea salió averiada."
      Icono={IconoAveria}
      escena="averia"
      cifras={(d) => (
        <>
          <CifraEstado
            variante="vidrio"
            etiqueta="Averías (%)"
            valor={d?.averiasVsFabricado.total.porcentaje ?? null}
            tono="alerta"
            formato={dosDecimales}
          />
          <CifraEstado variante="vidrio" etiqueta="Averiadas" detalle="unidades" valor={d?.averiasVsFabricado.total.averiadasUnidades ?? null} tono="critico" />
          <CifraEstado variante="vidrio" etiqueta="Fabricadas" detalle="unidades aprobadas, con extraoficiales" valor={d?.averiasVsFabricado.total.fabricadoUnidades ?? null} tono="exito" />
          {/* Las bolsas sin convertir se avisan dentro de la vista (Alerta) cuando las hay. */}
          <CifraEstado variante="vidrio" etiqueta="Extraoficiales" detalle="unidades de emergencia, ya incluidas" valor={d?.averiasVsFabricado.total.extraoficialUnidades ?? null} tono="acento" />
        </>
      )}
    >
      {(d) => <VistaAveriasFabricado datos={d} />}
    </TableroConIndicadores>
  )
}
