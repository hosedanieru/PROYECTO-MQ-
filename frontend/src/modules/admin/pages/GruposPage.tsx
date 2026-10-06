/**
 * ADMINISTRACIÓN DE GRUPOS (antes "proveedores")
 * ==============================================
 *
 * Quien pone el personal del turno. El proveedor real se escribe en la
 * descripción (texto libre). "Personas esperadas" es lo que el grupo
 * debería enviar a CADA turno (usuario, 2026-10-03): se compara con la
 * asistencia registrada en la programación del día; un día puntual se
 * ajusta desde la programación, con motivo. Sin eliminar: se desactiva.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { Iniciales } from '../../../components/Iniciales'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoPersonas } from '../../../components/Iconos'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { Grupo } from '../../../shared/types/catalogo'
import { catalogoApi } from '../../catalogo/api/catalogo.api'
import { useGrupos, useTurnos } from '../../catalogo/hooks/useCatalogos'

interface Form {
  codigo: string
  nombre: string
  descripcion: string
  /** { turnoId: texto del campo } */
  esperadas: Record<string, string>
}

const VACIO: Form = { codigo: '', nombre: '', descripcion: '', esperadas: {} }

/** Total del día: suma de los turnos donde se espera al grupo. */
const totalDia = (g: Grupo) => Object.values(g.esperadasPorTurno).reduce((s, n) => s + n, 0)

export function GruposPage() {
  const qc = useQueryClient()
  const grupos = useGrupos()
  const turnos = useTurnos()
  const turnosActivos = (turnos.data ?? []).filter((t) => t.activo)
  const [editando, setEditando] = useState<Grupo | 'nuevo' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['catalogo', 'grupos'] })

  const abrir = (g: Grupo | 'nuevo') => {
    setForm(
      g === 'nuevo'
        ? VACIO
        : {
            codigo: g.codigo,
            nombre: g.nombre,
            descripcion: g.descripcion ?? '',
            esperadas: Object.fromEntries(
              Object.entries(g.esperadasPorTurno).map(([turnoId, n]) => [turnoId, String(n)]),
            ),
          },
    )
    setEditando(g)
  }

  const guardar = useMutation({
    mutationFn: () => {
      const datos = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        // Vacío = el grupo no se espera en ese turno.
        esperadasPorTurno: Object.entries(form.esperadas)
          .filter(([, v]) => v.trim() !== '')
          .map(([turnoId, v]) => ({ turnoId, personas: Number(v) })),
      }
      return editando === 'nuevo'
        ? catalogoApi.crearGrupo(datos)
        : catalogoApi.actualizarGrupo((editando as Grupo).id, datos)
    },
    onSuccess: () => {
      invalidar()
      setEditando(null)
    },
  })
  const cambiarActivo = useMutation({
    mutationFn: (g: Grupo) => catalogoApi.actualizarGrupo(g.id, { activo: !g.activo }),
    onSuccess: invalidar,
  })

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <EncabezadoPagina
        Icono={IconoPersonas}
        escena="personas"
        titulo="Grupos"
        descripcion="Quien pone el personal del turno. El proveedor se escribe en la descripción."
        acciones={
          <Boton variante="claro" onClick={() => abrir('nuevo')}>
            + Nuevo grupo
          </Boton>
        }
      />

      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <Seccion
        titulo="Grupos"
        contador={grupos.data?.length}
        descripcion="A la derecha, las personas que el grupo debería enviar en el día; debajo, cuántas por turno."
      >
        <ListaRegistros
          cargando={grupos.isLoading}
          estaVacia={grupos.data?.length === 0}
          vacio={
            <EstadoVacio
              Icono={IconoPersonas}
              titulo="Sin grupos"
              texto="Cree el primer grupo con las personas que debería enviar a cada turno."
              accion={<Boton onClick={() => abrir('nuevo')}>+ Nuevo grupo</Boton>}
            />
          }
        >
          {grupos.data?.map((g) => {
            const total = totalDia(g)
            return (
              <FilaRegistro
                key={g.id}
                tono={!g.activo ? undefined : g.descripcion && total ? 'marca' : 'alerta'}
                apagada={!g.activo}
                etiqueta={
                  <>
                    <Iniciales nombre={g.nombre} activo={g.activo} />
                    {!g.activo && <Badge tono="neutro">Inactivo</Badge>}
                  </>
                }
                titulo={g.nombre}
                detalle={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="cifra">{g.codigo}</span>
                    {g.descripcion ? <span>{g.descripcion}</span> : <Badge tono="alerta">Sin proveedor</Badge>}
                  </span>
                }
                meta={turnosActivos.map((t) => (
                  <MetaDato key={t.id} etiqueta={t.codigo}>
                    {g.esperadasPorTurno[t.id] ?? '—'}
                  </MetaDato>
                ))}
                cifra={total || '—'}
                colorCifra={total ? 'text-tinta' : 'text-alerta'}
                notaCifra={total ? 'personas / día' : 'sin personas esperadas'}
                acciones={
                  <>
                    <Boton variante="secundario" tamano="sm" onClick={() => abrir(g)}>
                      Editar
                    </Boton>
                    <Boton variante="sutil" tamano="sm" onClick={() => cambiarActivo.mutate(g)}>
                      {g.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  </>
                }
              />
            )
          })}
        </ListaRegistros>
      </Seccion>

      <Dialogo
        abierto={editando !== null}
        titulo={
          editando === 'nuevo' ? 'Nuevo grupo' : `Editar grupo ${(editando as Grupo | null)?.codigo ?? ''}`
        }
        onCerrar={() => setEditando(null)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            guardar.mutate()
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Código"
              placeholder="LOGICMARD"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            />
            <Campo
              etiqueta="Nombre"
              placeholder="Grupo 1"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>
          <AreaTexto
            etiqueta="Descripción (proveedor, contacto…)"
            rows={3}
            placeholder="Ej.: Proveedor Logicmard S.A.S. — contacto Juan Pérez"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-tinta-suave">Personas esperadas por turno</legend>
            <div className="grid grid-cols-3 gap-3">
              {turnosActivos.map((t) => (
                <Campo
                  key={t.id}
                  etiqueta={t.nombre}
                  type="number"
                  min={1}
                  max={500}
                  placeholder="no viene"
                  value={form.esperadas[t.id] ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      esperadas: { ...form.esperadas, [t.id]: e.target.value },
                    })
                  }
                />
              ))}
            </div>
            <p className="text-xs text-tinta-suave">
              Total del día:{' '}
              <strong className="cifra text-tinta">
                {Object.values(form.esperadas).reduce((s, v) => s + (Number(v) || 0), 0)}
              </strong>{' '}
              personas. Vacío = el grupo no se espera en ese turno. Se compara con las que llegaron: si llegan
              menos, el turno queda afectado; un día puntual se ajusta desde la programación, con motivo.
            </p>
          </fieldset>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={guardar.isPending}
              disabled={!form.codigo.trim() || !form.nombre.trim()}
            >
              Guardar
            </Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
