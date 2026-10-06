/**
 * Hooks de datos del módulo. Encapsulan las claves de caché para que
 * una mutación (crear, entregar...) invalide exactamente lo que toca:
 * el listado y el detalle de esa remisión.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { REFRESCO_TABLERO } from '../../../shared/refresco'
import {
  ESTADOS_REMISION,
  type EditarRemisionDatos,
  type EstadoRemision,
  type FiltroRemisiones,
  type TipoFirma,
} from '../../../shared/types/remision'
import { remisionesApi } from '../api/remisiones.api'

const CLAVE = 'remisiones'

/**
 * `refrescoMs` deja que cada pantalla elija su ritmo: el tablero mira lo
 * de hoy cada pocos segundos, pero el total de ayer no necesita volver a
 * pedirse casi nunca. Sin él, todas las consultas irían al mismo ritmo y
 * el listado entero se recargaría por gusto.
 */
export function useRemisiones(filtro: FiltroRemisiones, habilitado = true, refrescoMs?: number) {
  return useQuery({
    queryKey: [CLAVE, 'lista', filtro],
    queryFn: () => remisionesApi.listar(filtro),
    enabled: habilitado,
    refetchInterval: refrescoMs,
    placeholderData: (anterior) => anterior, // no parpadear al cambiar de página
  })
}

/** Un conteo en cero, para poder pintar el tablero mientras carga. */
const CONTEO_VACIO = Object.fromEntries(ESTADOS_REMISION.map((e) => [e, 0])) as Record<
  EstadoRemision,
  number
>

/**
 * Cuántas remisiones hay de cada estado en un día operativo.
 *
 * UNA sola petición a `/remisiones/resumen`, que cuenta en el servidor y
 * devuelve seis números.
 *
 * Antes eran seis consultas, una por estado. Funcionaba, pero en
 * Firestore cada listado LEE TODOS los documentos del día y filtra en
 * memoria: seis listados = seis lecturas completas del día, cada vez que
 * el tablero se refresca. Con el refresco automático eso se multiplica
 * y es lo que tumbaba el backend.
 *
 * Solo lo usa el tablero, así que lleva su ritmo puesto.
 */
export function useConteoPorEstado(fecha: string, habilitado = true) {
  const consulta = useQuery({
    queryKey: [CLAVE, 'conteo', fecha],
    queryFn: () => remisionesApi.resumen({ desde: fecha, hasta: fecha }),
    enabled: habilitado && Boolean(fecha),
    refetchInterval: REFRESCO_TABLERO,
    staleTime: REFRESCO_TABLERO,
  })

  return {
    porEstado: consulta.data?.porEstado ?? CONTEO_VACIO,
    total: consulta.data?.total ?? 0,
    cargando: consulta.isLoading,
    error: consulta.error,
  }
}

/**
 * El mismo conteo por estado, pero con los filtros del listado (rango,
 * turno, grupo). Alimenta las cifras sobre la tabla. Sin refresco
 * automático: el listado tampoco lo tiene. La clave cuelga de 'conteo',
 * así que las acciones del flujo ya la invalidan.
 */
export function useResumenRemisiones(filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina' | 'estado'>) {
  const consulta = useQuery({
    queryKey: [CLAVE, 'conteo', 'filtro', filtro],
    queryFn: () => remisionesApi.resumen(filtro),
    placeholderData: (anterior) => anterior,
  })

  return {
    porEstado: consulta.data?.porEstado ?? null,
    total: consulta.data?.total ?? null,
  }
}

export function useRemision(id: string | undefined) {
  return useQuery({
    queryKey: [CLAVE, 'detalle', id],
    queryFn: () => remisionesApi.obtener(id!),
    enabled: Boolean(id),
  })
}

export function useVersionesRemision(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: [CLAVE, 'versiones', id],
    queryFn: () => remisionesApi.versiones(id),
    enabled: habilitado,
  })
}

export function useAuditoriaRemision(id: string, habilitado: boolean) {
  return useQuery({
    queryKey: [CLAVE, 'auditoria', id],
    queryFn: () => remisionesApi.auditoria(id),
    enabled: habilitado,
  })
}

export function useCrearRemision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: remisionesApi.crear,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] }),
  })
}

export function useEditarRemision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cambios: EditarRemisionDatos) => remisionesApi.editar(id, cambios),
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
    },
  })
}

/**
 * Una sola mutación para las cinco transiciones. Cada acción recibe el
 * id y, si aplica, sus datos; al terminar refresca lista y detalle.
 */
export type AccionRemision =
  | { tipo: 'entregar' }
  | { tipo: 'aprobar'; opaNombre: string; opaCargo?: string }
  | { tipo: 'rechazar'; motivo: string }
  | { tipo: 'rectificar' }
  | { tipo: 'validar'; concilidadoCon: string }

export function useAccionRemision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accion: AccionRemision) => {
      switch (accion.tipo) {
        case 'entregar':
          return remisionesApi.entregar(id)
        case 'aprobar':
          return remisionesApi.aprobar(id, { opaNombre: accion.opaNombre, opaCargo: accion.opaCargo })
        case 'rechazar':
          return remisionesApi.rechazar(id, { motivo: accion.motivo })
        case 'rectificar':
          return remisionesApi.rectificar(id)
        case 'validar':
          return remisionesApi.validar(id, { concilidadoCon: accion.concilidadoCon })
      }
    },
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'conteo'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'versiones', id] })
      // Rectificar cambia la versión: las firmas vigentes cambian.
      void qc.invalidateQueries({ queryKey: [CLAVE, 'firmas', id] })
      void qc.invalidateQueries({ queryKey: ['mfr'] })
    },
  })
}

/** Casillas del formato con su firma vigente, más el historial de versiones anteriores. */
export function useFirmasRemision(id: string) {
  return useQuery({
    queryKey: [CLAVE, 'firmas', id],
    queryFn: () => remisionesApi.firmas(id),
  })
}

/** Validar firmando cambia el estado: invalida lo mismo que una acción del flujo, más las firmas. */
export function useValidarFirmando(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: { concilidadoCon: string; trazo: string; contrasena: string }) => remisionesApi.validarFirmando(id, datos),
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'conteo'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'firmas', id] })
    },
  })
}

/** Aprobar firmando cambia el estado y descuenta inventario: invalida lo mismo que una acción del flujo, más las firmas. */
export function useAprobarFirmando(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: { trazo: string; contrasena: string }) => remisionesApi.aprobarFirmando(id, datos),
    onSuccess: (remision) => {
      qc.setQueryData([CLAVE, 'detalle', id], remision)
      void qc.invalidateQueries({ queryKey: [CLAVE, 'lista'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'conteo'] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'firmas', id] })
      void qc.invalidateQueries({ queryKey: ['mfr'] })
      void qc.invalidateQueries({ queryKey: ['inventario'] })
    },
  })
}

export function useFirmarRemision(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (datos: { tipo: TipoFirma; trazo: string; contrasena: string }) => remisionesApi.firmar(id, datos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CLAVE, 'firmas', id] })
      void qc.invalidateQueries({ queryKey: [CLAVE, 'auditoria', id] })
    },
  })
}
