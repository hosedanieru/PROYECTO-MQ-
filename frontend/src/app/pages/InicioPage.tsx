/**
 * INICIO
 * ======
 *
 * Portada: saludo, los AVISOS del día (qué requiere acción) y los accesos
 * rápidos.
 *
 * Decisión del usuario (2026-10-06): las cifras y gráficas salieron de
 * aquí a los tableros (menú "Tableros ▾", uno por indicador); el Inicio
 * queda solo con avisos y accesos. Los avisos siguen calculándose con los
 * datos del día (MFR, remisiones, averías, inventario) y cada uno lleva a
 * donde se resuelve.
 */

import { Badge } from '../../components/Badge'
import { EncabezadoPagina } from '../../components/EncabezadoPagina'
import { IconoInicio } from '../../components/Iconos'
import { Seccion } from '../../components/Seccion'
import { useTextos } from '../../shared/idioma/useTextos'
import { useSesion } from '../../modules/auth/useSesion'
import { useIndicadorAverias } from '../../modules/averias/hooks/useAverias'
import { useAlertasInventario } from '../../modules/inventario/hooks/useInventario'
import { useIndicadoresDia } from '../../modules/mfr/hooks/useMfr'
import { useConteoPorEstado } from '../../modules/remisiones/hooks/useRemisiones'
import { REFRESCO_TABLERO } from '../../shared/refresco'
import { fechaCorta, fechaOperativaDe } from '../../shared/utils/fechas'
import { AccesosRapidos } from './inicio/AccesosRapidos'
import { AvisosDia } from './inicio/AvisosDia'
import { construirAvisos } from './inicio/avisos'

/** Clave del saludo según la hora de Bogotá. */
function claveSaludo(instante: Date): 'inicio.buenosDias' | 'inicio.buenasTardes' | 'inicio.buenasNoches' {
  const hora = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false }).format(instante),
  )
  if (hora < 12) return 'inicio.buenosDias'
  if (hora < 19) return 'inicio.buenasTardes'
  return 'inicio.buenasNoches'
}

export function InicioPage() {
  const { usuario, tienePermiso } = useSesion()
  const { t } = useTextos()
  const ahora = new Date()
  const fecha = fechaOperativaDe(ahora)

  const puedeRemisiones = tienePermiso('remision.consultar')
  // Solo lo que alimenta los avisos; cada consulta con su ritmo (ver `shared/refresco.ts`).
  const conteo = useConteoPorEstado(fecha, puedeRemisiones)
  const dia = useIndicadoresDia(fecha, tienePermiso('mfr.consultar'), REFRESCO_TABLERO)
  const averiasDia = useIndicadorAverias(fecha, fecha, tienePermiso('averia.consultar'))
  const inventarioDia = useAlertasInventario(fecha, tienePermiso('inventario.consultar'))

  const avisos = construirAvisos({
    indicadores: dia.data,
    porEstado: puedeRemisiones ? conteo.porEstado : undefined,
    averias: averiasDia.data,
    inventario: inventarioDia.data,
    fecha,
  })

  return (
    <div className="space-y-8">
      <EncabezadoPagina
        Icono={IconoInicio}
        titulo={`${t(claveSaludo(ahora))}, ${usuario?.nombre?.split(' ')[0] ?? ''}`}
        insignia={
          <Badge tono="exito" punto>
            {t('inicio.diaEnCurso')}
          </Badge>
        }
        descripcion={t('inicio.subtitulo', { fecha: fechaCorta(fecha) })}
      />

      {/* ¿Qué requiere acción? */}
      <Seccion
        titulo={t('inicio.avisosTitulo')}
        contador={avisos.length}
        descripcion={t('inicio.avisosDescripcion')}
        tono={avisos.some((a) => a.tono === 'critico') ? 'critico' : avisos.length > 0 ? 'alerta' : 'exito'}
      >
        <AvisosDia avisos={avisos} />
      </Seccion>

      <Seccion titulo={t('inicio.accesosRapidos')} tono="neutro">
        <AccesosRapidos tienePermiso={tienePermiso} />
      </Seccion>
    </div>
  )
}
