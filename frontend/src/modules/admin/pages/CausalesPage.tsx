/**
 * ADMINISTRACIÓN DE CAUSALES DE AVERÍA
 * ====================================
 *
 * La lista desplegable del formulario de averías. Viene de la base de
 * datos (usuario, 2026-09-28) para que el área agregue causales sin
 * tocar el sistema. `orden` es la posición en la lista. Sin eliminar:
 * se desactiva (deja de salir en el formulario, pero los reportes viejos
 * la siguen mostrando).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { FilaRegistro, ListaRegistros } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { Boton } from '../../../components/Boton'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoLista } from '../../../components/Iconos'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { CausalAveria } from '../../../shared/types/averia'
import { averiasApi } from '../../averias/api/averias.api'
import { useCausales } from '../../averias/hooks/useAverias'

interface Form {
  codigo: string
  nombre: string
  orden: string
}

export function CausalesPage() {
  const qc = useQueryClient()
  const causales = useCausales()
  const [editando, setEditando] = useState<CausalAveria | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>({ codigo: '', nombre: '', orden: '' })
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['averias', 'causales'] })

  const abrir = (c: CausalAveria | 'nuevo') => {
    const siguienteOrden = Math.max(0, ...(causales.data ?? []).map((x) => x.orden)) + 1
    setForm(
      c === 'nuevo'
        ? { codigo: '', nombre: '', orden: String(siguienteOrden) }
        : { codigo: c.codigo, nombre: c.nombre, orden: String(c.orden) },
    )
    setEditando(c)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        orden: Number(form.orden),
      }
      return editando === 'nuevo'
        ? averiasApi.crearCausal(datos)
        : averiasApi.actualizarCausal((editando as CausalAveria).id, datos)
    },
    onSuccess: () => {
      invalidar()
      setEditando(null)
    },
  })
  const cambiarActivo = useMutation({
    mutationFn: (c: CausalAveria) => averiasApi.actualizarCausal(c.id, { activo: !c.activo }),
    onSuccess: invalidar,
  })

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <EncabezadoPagina
        Icono={IconoLista}
        escena="averia"
        titulo="Causales de avería"
        descripcion="La lista desplegable del reporte de averías, en este orden."
        acciones={
          <Boton variante="claro" onClick={() => abrir('nuevo')}>
            + Nueva causal
          </Boton>
        }
      />

      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      {/* La lista ES el orden del desplegable: el número va grande al inicio de cada fila. */}
      <Seccion titulo="Causales, en el orden del desplegable" contador={causales.data?.length} tono="alerta">
        <ListaRegistros
          cargando={causales.isLoading}
          estaVacia={causales.data?.length === 0}
          vacio={
            <EstadoVacio
              Icono={IconoLista}
              titulo="Sin causales"
              texto="Agregue la primera: es lo que elige quien reporta una avería."
              accion={<Boton onClick={() => abrir('nuevo')}>+ Nueva causal</Boton>}
            />
          }
        >
          {causales.data?.map((c) => (
            <FilaRegistro
              key={c.id}
              tono={c.activo ? 'alerta' : undefined}
              apagada={!c.activo}
              etiqueta={
                <>
                  <span className="cifra grid h-8 min-w-8 place-items-center rounded-full bg-velo px-2 text-sm font-black text-tinta">
                    {c.orden}
                  </span>
                  {!c.activo && <Badge tono="neutro">Inactiva</Badge>}
                </>
              }
              titulo={c.nombre}
              detalle={<span className="cifra">{c.codigo}</span>}
              acciones={
                <>
                  <Boton variante="secundario" tamano="sm" onClick={() => abrir(c)}>
                    Editar
                  </Boton>
                  <Boton variante="sutil" tamano="sm" onClick={() => cambiarActivo.mutate(c)}>
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? 'Nueva causal' : 'Editar causal'}
        onCerrar={() => setEditando(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            guardar.mutate()
          }}
          className="space-y-4"
        >
          <Campo
            etiqueta="Nombre (como sale en la lista)"
            placeholder="Bolsa - rota"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Código"
              placeholder="BOLSA_ROTA"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            />
            <Campo
              etiqueta="Orden en la lista"
              type="number"
              min={0}
              value={form.orden}
              onChange={(e) => setForm({ ...form, orden: e.target.value })}
            />
          </div>
          <p className="text-xs text-tinta-suave">
            El código identifica la causal (letras, números y guion bajo). El nombre es lo que ve quien
            reporta.
          </p>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={guardar.isPending}
              disabled={!form.codigo.trim() || !form.nombre.trim() || form.orden === ''}
            >
              Guardar
            </Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
