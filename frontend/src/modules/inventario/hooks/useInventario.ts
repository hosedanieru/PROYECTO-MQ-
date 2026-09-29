/**
 * Consultas y mutaciones de inventario.
 *
 * Claves de caché:
 *   ['inventario', 'items', filtro]     existencias
 *   ['inventario', 'item', id]          un ítem
 *   ['inventario', 'kardex', id]        movimientos de un ítem
 *   ['inventario', 'entradas', …]       entradas de mercancía de un rango
 *   ['inventario', 'entrada', id]       una entrada con sus líneas
 *
 * Un movimiento cambia la existencia y el kardex de su ítem: se refrescan
 * esos, y los listados de existencias.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  CambiosItem,
  DatosAjuste,
  DatosEntrada,
  DatosMovimiento,
  DatosNuevoItem,
  TipoItem,
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

export function useCrearItem() {
  const refrescar = useRefrescarItem()
  return useMutation({ mutationFn: (d: DatosNuevoItem) => inventarioApi.crearItem(d), onSuccess: (item) => refrescar(item.id) })
}

export function useActualizarItem() {
  const refrescar = useRefrescarItem()
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: CambiosItem }) => inventarioApi.actualizarItem(id, cambios),
    onSuccess: (item) => refrescar(item.id),
  })
}
