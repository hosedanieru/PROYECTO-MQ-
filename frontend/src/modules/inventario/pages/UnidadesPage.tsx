/**
 * UNIDADES DE MEDIDA
 * ==================
 *
 * La lista desplegable de "unidad base" de PI e insumos (UNIDAD, ROLLO,
 * PAQUETE…). Caja y estiba no van aquí: son presentaciones con su
 * equivalencia en cada PI o insumo. Sin eliminar: se desactiva.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { FilaRegistro, ListaRegistros } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { UnidadMedida } from '../../../shared/types/inventario'
import { useGuardarUnidad, useUnidades } from '../hooks/useInventario'

export function UnidadesPage() {
  const unidades = useUnidades()
  const guardar = useGuardarUnidad()
  const [editando, setEditando] = useState<UnidadMedida | 'nueva' | null>(null)
  const [form, setForm] = useState({ codigo: '', nombre: '' })

  const abrir = (u: UnidadMedida | 'nueva') => {
    setForm(u === 'nueva' ? { codigo: '', nombre: '' } : { codigo: u.codigo, nombre: u.nombre })
    guardar.reset()
    setEditando(u)
  }
  const enviar = () =>
    guardar.mutate(
      { id: editando === 'nueva' ? undefined : (editando as UnidadMedida).id, datos: { codigo: form.codigo.trim(), nombre: form.nombre.trim() } },
      { onSuccess: () => setEditando(null) },
    )

  return (
    <section className="space-y-5">
      {guardar.isError && editando === null && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}

      <Seccion
        titulo="Unidades de medida"
        contador={unidades.data?.length}
        descripcion="En qué se cuentan los PI y los insumos (la lista desplegable). Caja y estiba se definen como equivalencias en cada uno."
        accion={<Boton onClick={() => abrir('nueva')}>+ Nueva unidad</Boton>}
      >
        <ListaRegistros cargando={unidades.isLoading}>
          {unidades.data?.map((u) => (
            <FilaRegistro
              key={u.id}
              tono={u.activo ? 'marca' : undefined}
              apagada={!u.activo}
              etiqueta={!u.activo && <Badge tono="neutro">Inactiva</Badge>}
              titulo={u.nombre}
              detalle={<span className="cifra">{u.codigo}</span>}
              acciones={
                <>
                  <Boton variante="secundario" tamano="sm" onClick={() => abrir(u)}>
                    Editar
                  </Boton>
                  <Boton variante="sutil" tamano="sm" onClick={() => guardar.mutate({ id: u.id, datos: { activo: !u.activo } })}>
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>

      <Dialogo abierto={editando !== null} titulo={editando === 'nueva' ? 'Nueva unidad de medida' : 'Editar unidad'} onCerrar={() => setEditando(null)}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (form.codigo.trim() && form.nombre.trim()) enviar() }}>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Código" placeholder="ROLLO" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            <Campo etiqueta="Nombre" placeholder="Rollo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={!form.codigo.trim() || !form.nombre.trim()}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
