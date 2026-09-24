import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { comoErrorApi } from '../../../services/http'
import type { DatosBloque, ResultadoDiaCarga, ResultadoPeriodo } from '../../../shared/types/mfr'
import { mfrApi } from '../api/mfr.api'

const CLAVE = 'mfr'

/** Invalida todo lo del módulo: tablero, bloques y catálogos. */
function useInvalidarDia() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: [CLAVE] })
}

/**
 * `habilitado` permite no consultar a quien no tiene `mfr.consultar`.
 * `refrescoMs` deja que el tablero de inicio vaya más rápido que el
 * resto sin acelerar todas las pantallas (ver `shared/refresco.ts`).
 */
export function useIndicadoresDia(fecha: string, habilitado = true, refrescoMs?: number) {
  return useQuery({
    queryKey: [CLAVE, 'dia', fecha],
    queryFn: () => mfrApi.dia(fecha),
    enabled: habilitado && Boolean(fecha),
    refetchInterval: refrescoMs,
  })
}

export function useGuardarBloque() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.guardarBloque, onSuccess: invalidar })
}

export function useEliminarBloque() {
  const invalidar = useInvalidarDia()
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => mfrApi.eliminarBloque(id, motivo),
    onSuccess: invalidar,
  })
}

export function useCargarDia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.cargarDia, onSuccess: invalidar })
}

/**
 * Carga de N días, un día por petición.
 *
 * El backend tiene `/mfr/bloques/periodo`, que hace lo mismo en una sola
 * petición, y sigue siendo la vía para scripts. Pero para la pantalla no
 * sirve: un DPP semanal tardaba más de lo que el navegador espera y, al
 * abortar, se perdía el detalle de qué día había entrado aunque el
 * servidor siguiera escribiendo.
 *
 * Aquí se recorre día por día: cada petición es corta, se puede mostrar
 * el avance y, si una falla, las anteriores ya quedaron guardadas y se
 * informa exactamente dónde se detuvo. Cada día sigue siendo atómico del
 * lado del servidor: eso no cambia.
 */
export function useCargarPeriodoPorDia() {
  const invalidar = useInvalidarDia()
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null)

  const mutacion = useMutation({
    mutationFn: async (datos: {
      bloques: Array<DatosBloque & { fechaOperativa: string }>
      origen: 'MANUAL' | 'DPP'
      reemplazar: boolean
      motivo?: string
    }): Promise<ResultadoPeriodo> => {
      const porDia = new Map<string, typeof datos.bloques>()
      for (const b of datos.bloques) {
        porDia.set(b.fechaOperativa, [...(porDia.get(b.fechaOperativa) ?? []), b])
      }
      const fechas = [...porDia.keys()].sort()

      const dias: ResultadoDiaCarga[] = []
      setAvance({ hechos: 0, total: fechas.length })

      for (const [i, fechaOperativa] of fechas.entries()) {
        try {
          const creados = await mfrApi.cargarDia({
            fechaOperativa,
            origen: datos.origen,
            reemplazar: datos.reemplazar,
            motivo: datos.motivo,
            bloques: porDia.get(fechaOperativa)!.map(({ fechaOperativa: _dia, ...resto }) => resto),
          })
          dias.push({ fechaOperativa, estado: 'CARGADO', bloquesCreados: creados.length })
        } catch (error) {
          const e = comoErrorApi(error)
          dias.push({
            fechaOperativa,
            // Que el día ya tuviera programación no es una falla: es lo
            // normal al recargar una semana sin pedir reemplazo.
            estado: e.codigo === 'MFR_DIA_CON_PROGRAMACION' ? 'OMITIDO' : 'ERROR',
            bloquesCreados: 0,
            codigo: e.codigo,
            mensaje: e.mensaje,
          })
        }
        setAvance({ hechos: i + 1, total: fechas.length })
      }

      return {
        dias,
        totalBloquesCreados: dias.reduce((s, d) => s + d.bloquesCreados, 0),
        diasCargados: dias.filter((d) => d.estado === 'CARGADO').length,
      }
    },
    onSuccess: invalidar,
    onSettled: () => setAvance(null),
  })

  return { ...mutacion, avance }
}

export function useCopiarDia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.copiarDia, onSuccess: invalidar })
}

export function useCerrarTurno() {
  const invalidar = useInvalidarDia()
  return useMutation({
    mutationFn: ({ fechaOperativa, turnoId, motivoFaltante }: { fechaOperativa: string; turnoId: string; motivoFaltante?: string }) =>
      mfrApi.cerrarTurno(fechaOperativa, turnoId, motivoFaltante),
    onSuccess: invalidar,
  })
}

export function useRegistrarAsistencia() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.registrarAsistencia, onSuccess: invalidar })
}

export function useAsignarGrupoLinea() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.asignarGrupoLinea, onSuccess: invalidar })
}

export function useQuitarAsignacion() {
  const invalidar = useInvalidarDia()
  return useMutation({ mutationFn: mfrApi.quitarAsignacion, onSuccess: invalidar })
}

export function useAnalizarDpp() {
  return useMutation({ mutationFn: mfrApi.analizarDpp })
}

export function useLineas() {
  return useQuery({ queryKey: [CLAVE, 'lineas'], queryFn: mfrApi.lineas, staleTime: 5 * 60 * 1000 })
}

export function useEstandares() {
  return useQuery({ queryKey: [CLAVE, 'estandares'], queryFn: mfrApi.estandares, staleTime: 60 * 1000 })
}

/** Carga en lote de estándares. Invalida también los productos: comparten los mismos campos. */
export function useActualizarEstandaresEnLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: mfrApi.actualizarEstandaresEnLote,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CLAVE] })
      void qc.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}
