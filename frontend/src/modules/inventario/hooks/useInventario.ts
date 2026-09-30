/**
 * Consultas y mutaciones de inventario.
 *
 * Claves de caché:
 *   ['inventario', 'items', filtro]     existencias
 *   ['inventario', 'item', id]          un ítem
 *   ['inventario', 'kardex', id]        movimientos de un ítem
 *   ['inventario', 'entradas', …]       entradas de mercancía de un rango
 *   ['inventario', 'entrada', id]       una entrada con sus líneas
 *   ['inventario', 'recetas']           resumen: versión vigente de cada PT con receta
 *   ['inventario', 'receta', productoId] vigente + historial de un PT
 *
 * Un movimiento cambia la existencia y el kardex de su ítem: se refrescan
 * esos, y los listados de existencias.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ComponenteReceta,
  DatosAjuste,
  DatosEntrada,
  DatosMaterial,
  DatosMovimiento,
  TipoItem,
  TipoMaterial,
} from '../../../shared/types/inventario'
import { inventarioApi } from '../api/inventario.api'

export function useItemsInventario(filtro: { tipo?: TipoItem; texto?: string; soloActivos?: boolean } = {}) {
  return useQuery({ queryKey: ['inventario', 'items', filtro], queryFn: () => inventarioApi.items(filtro) })
}

export function useItemInventario(id: string) {
  return useQuery({ queryKey: ['inventario', 'item', id], queryFn: () => inventarioApi.item(id) })
}

export function useKardex(id: string) {
  return useQuery({ queryKey: ['inventario', 'kardex', id], queryFn: () => inventarioApi.kardex(id) })
}

function useRefrescarItem() {
  const qc = useQueryClient()
  return (itemId: string) => {
    void qc.invalidateQueries({ queryKey: ['inventario', 'items'] })
    void qc.invalidateQueries({ queryKey: ['inventario', 'item', itemId] })
    void qc.invalidateQueries({ queryKey: ['inventario', 'kardex', itemId] })
  }
}

export function useRegistrarMovimiento() {
  const refrescar = useRefrescarItem()
  return useMutation({ mutationFn: (d: DatosMovimiento) => inventarioApi.registrarMovimiento(d), onSuccess: (r) => refrescar(r.item.id) })
}

export function useRegistrarAjuste() {
  const refrescar = useRefrescarItem()
  return useMutation({ mutationFn: (d: DatosAjuste) => inventarioApi.registrarAjuste(d), onSuccess: (r) => refrescar(r.item.id) })
}

export function useEntradas(desde: string, hasta: string) {
  return useQuery({ queryKey: ['inventario', 'entradas', desde, hasta], queryFn: () => inventarioApi.entradas(desde, hasta) })
}

export function useEntrada(id: string) {
  return useQuery({ queryKey: ['inventario', 'entrada', id], queryFn: () => inventarioApi.entrada(id) })
}

/** Una entrada sube la existencia de varios ítems: se refrescan sus kardex y las listas. */
export function useRegistrarEntrada() {
  const qc = useQueryClient()
  const refrescar = useRefrescarItem()
  return useMutation({
    mutationFn: (d: DatosEntrada) => inventarioApi.registrarEntrada(d),
    onSuccess: (entrada) => {
      entrada.lineas.forEach((l) => refrescar(l.itemId))
      void qc.invalidateQueries({ queryKey: ['inventario', 'entradas'] })
    },
  })
}

// ---------- Catálogo: unidades, PI e insumos ----------

const CINCO_MINUTOS = 5 * 60 * 1000

export function useUnidades() {
  return useQuery({ queryKey: ['inventario', 'unidades'], queryFn: inventarioApi.unidades, staleTime: CINCO_MINUTOS })
}

export function useMateriales(tipo: TipoMaterial) {
  return useQuery({ queryKey: ['inventario', 'materiales', tipo], queryFn: () => inventarioApi.materiales(tipo) })
}

/** Cambiar el catálogo cambia lo que muestran las existencias: se refresca todo el módulo. */
function useRefrescarModulo() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['inventario'] })
}

export function useGuardarMaterial(tipo: TipoMaterial) {
  const refrescar = useRefrescarModulo()
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: Partial<DatosMaterial> & { activo?: boolean } }) =>
      id ? inventarioApi.actualizarMaterial(tipo, id, datos) : inventarioApi.crearMaterial(tipo, datos as DatosMaterial),
    onSuccess: refrescar,
  })
}

export function useGuardarUnidad() {
  const refrescar = useRefrescarModulo()
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: Partial<{ codigo: string; nombre: string; activo: boolean }> }) =>
      id ? inventarioApi.actualizarUnidad(id, datos) : inventarioApi.crearUnidad(datos as { codigo: string; nombre: string }),
    onSuccess: refrescar,
  })
}

// ---------- Receta del PT ----------

/** Versión vigente de cada PT que tiene receta (para marcar "Sin receta"). */
export function useResumenRecetas() {
  return useQuery({ queryKey: ['inventario', 'recetas'], queryFn: inventarioApi.resumenRecetas })
}

export function useReceta(productoId: string | null) {
  return useQuery({
    queryKey: ['inventario', 'receta', productoId],
    queryFn: () => inventarioApi.receta(productoId!),
    enabled: productoId !== null,
  })
}

/** Guardar crea una versión nueva: cambian esa receta y el resumen. */
export function useGuardarReceta(productoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (componentes: ComponenteReceta[]) => inventarioApi.guardarReceta(productoId, componentes),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventario', 'receta', productoId] })
      void qc.invalidateQueries({ queryKey: ['inventario', 'recetas'] })
    },
  })
}
