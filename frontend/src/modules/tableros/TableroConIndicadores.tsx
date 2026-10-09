import type { ComponentType, ReactNode, SVGProps } from 'react'

import { Alerta } from '../../components/Alerta'
import { EncabezadoPagina } from '../../components/EncabezadoPagina'
import { ConCarga } from '../../components/ConCarga'
import { comoErrorApi } from '../../services/http'
import type { TemaEscena } from '../../shared/visual3d/HeroVisual3D'
import type { IndicadoresPeriodo } from '../../shared/types/mfr'
import { useIndicadoresProduccion } from '../mfr/hooks/useMfr'
import { descripcionPeriodo } from './descripcionPeriodo'
import { SelectorPeriodo } from './SelectorPeriodo'
import { usePeriodoTablero } from './usePeriodoTablero'

interface Props {
  titulo: string
  /** Qué mide, en una frase; se le agrega el periodo. */
  queMide: string
  Icono: ComponentType<SVGProps<SVGSVGElement>>
  escena?: TemaEscena
  /** Cifras de la banda (CifraEstado en variante vidrio); `null` mientras carga. */
  cifras: (datos: IndicadoresPeriodo | null) => ReactNode
  /** El cuerpo del tablero. */
  children: (datos: IndicadoresPeriodo) => ReactNode
}

/**
 * MOLDE DE LOS TABLEROS DE INDICADORES
 * ====================================
 *
 * Decisión del usuario (2026-10-06): un tablero por indicador, aparte de
 * las pantallas con formularios. Los de FR, OTIF, PT, productividad y
 * averías vs fabricado leen la misma consulta (`/mfr/indicadores`), así
 * que comparten este molde: banda con el periodo y sus cifras, y el
 * cuerpo debajo. Pasar de un tablero a otro con el mismo periodo no
 * vuelve a consultar el servidor (la caché es por periodo).
 */
export function TableroConIndicadores({ titulo, queMide, Icono, escena = 'produccion', cifras, children }: Props) {
  const periodo = usePeriodoTablero()
  const consulta = useIndicadoresProduccion(periodo.desde, periodo.hasta)

  return (
    <section className="space-y-6">
      <EncabezadoPagina
        Icono={Icono}
        escena={escena}
        titulo={titulo}
        descripcion={`${queMide} ${descripcionPeriodo(periodo)}`}
        acciones={<SelectorPeriodo estado={periodo} />}
      >
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{cifras(consulta.data ?? null)}</div>
      </EncabezadoPagina>

      {consulta.isError && <Alerta tipo="error">{comoErrorApi(consulta.error).mensaje}</Alerta>}
      {/* Pasado el primer segundo, esqueleto; al llegar el dato, el barrido (ConCarga). */}
      <ConCarga cargando={consulta.isLoading} forma="detalle" mensaje={`Cargando ${titulo}…`}>
        {consulta.data && children(consulta.data)}
      </ConCarga>
    </section>
  )
}
