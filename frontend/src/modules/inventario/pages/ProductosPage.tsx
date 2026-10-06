/**
 * CATÁLOGO DE PT
 * ==============
 *
 * Carga manual uno a uno (decisión del 2026-09-16). Sin "eliminar": un
 * PT referenciado por remisiones se desactiva y deja de ofrecerse.
 * (Por dentro la tabla sigue llamándose `producto`.)
 *
 * Vive dentro del módulo de Inventario (pestaña "PT"; usuario,
 * 2026-09-29: un solo apartado). Crear un PT crea su existencia en el
 * inventario, y desactivarlo la desactiva.
 *
 * Receta (usuario, 2026-09-29): obligatoria al crear un PT nuevo; para
 * los que ya existían se digita con el botón "Receta" de la fila, que
 * guarda una versión nueva cada vez.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoCaja } from '../../../components/Iconos'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { PROCESOS_PRODUCTO, type Producto } from '../../../shared/types/catalogo'
import type { ComponenteReceta } from '../../../shared/types/inventario'
import { useSesion } from '../../auth/useSesion'
import { catalogoApi } from '../../catalogo/api/catalogo.api'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { mfrApi } from '../../mfr/api/mfr.api'
import { useEstandares } from '../../mfr/hooks/useMfr'
import { EditorReceta } from '../components/EditorReceta'
import { RecetaDialogo } from '../components/RecetaDialogo'
import { useResumenRecetas } from '../hooks/useInventario'
import { recetaValida } from '../receta'

const opcionalEntero = z
  .string()
  .transform((v) => (v.trim() === '' ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Entero mayor que cero.')

const opcionalDecimal = z
  .string()
  .transform((v) => (v.trim() === '' ? null : Number(v.replace(',', '.'))))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Número mayor que cero.')

/**
 * Los estándares (cajas/h, peso) se pueden dar al crear sin motivo; al
 * editar, cambiarlos exige motivo porque quedan auditados aparte.
 */
function construirEsquema(actual: Producto | null) {
  return z
    .object({
      codigo: z.string().trim().regex(/^[A-Za-z0-9._-]{1,40}$/, 'Letras, números, punto, guion o guion bajo (máx. 40).'),
      descripcion: z.string().trim().min(1, 'Obligatoria.').max(200),
      proceso: z.enum(PROCESOS_PRODUCTO).or(z.literal('')),
      unidadesPorCaja: opcionalEntero,
      cajasPorEstiba: opcionalEntero,
      personasIdeal: z
        .string()
        .transform((v) => (v.trim() === '' ? null : Number(v)))
        .refine((v) => v === null || (Number.isInteger(v) && v >= 0), 'Entero mayor o igual a cero.'),
      subdescripcion: z.string().trim().max(40, 'Máximo 40 caracteres.'),
      cajasPorHora: opcionalDecimal,
      pesoNetoKg: opcionalDecimal,
      motivoEstandar: z.string(),
    })
    .refine(
      (d) => !actual || !cambiaEstandar(actual, d) || d.motivoEstandar.trim().length >= 5,
      { message: 'Cambiar cajas/hora o peso exige el motivo (mínimo 5 caracteres).', path: ['motivoEstandar'] },
    )
}
type Esquema = ReturnType<typeof construirEsquema>
type Entrada = z.input<Esquema>
type Salida = z.output<Esquema>

function cambiaEstandar(actual: Producto, d: { cajasPorHora: number | null; pesoNetoKg: number | null }): boolean {
  return d.cajasPorHora !== actual.cajasPorHora || d.pesoNetoKg !== actual.pesoNetoKg
}

export function ProductosPage() {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const productos = useProductos({ texto })
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)
  const { tienePermiso } = useSesion()
  const estandares = useEstandares()
  const [estandarDe, setEstandarDe] = useState<Producto | null>(null)
  const [formEstandar, setFormEstandar] = useState({ cajasPorHora: '', pesoNetoKg: '', motivo: '' })
  const estandarActual = estandares.data?.find((x) => x.productoId === estandarDe?.id)
  // Receta: la del PT nuevo (obligatoria) y el diálogo de la fila.
  const [recetaNueva, setRecetaNueva] = useState<ComponenteReceta[]>([])
  const [recetaDe, setRecetaDe] = useState<Producto | null>(null)
  const resumenRecetas = useResumenRecetas()
  const recetaVigente = useMemo(() => new Map((resumenRecetas.data ?? []).map((r) => [r.productoId, r])), [resumenRecetas.data])
  const sinReceta = resumenRecetas.data ? (productos.data ?? []).filter((p) => p.activo && !recetaVigente.has(p.id)).length : 0
  const abrirNuevo = () => {
    setRecetaNueva([])
    setEditando('nuevo')
  }

  const abrirEstandar = (p: Producto) => {
    setFormEstandar({ cajasPorHora: p.cajasPorHora?.toString() ?? '', pesoNetoKg: p.pesoNetoKg?.toString() ?? '', motivo: '' })
    setEstandarDe(p)
  }
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['productos'] })
    void qc.invalidateQueries({ queryKey: ['mfr'] })
    // Crear un producto crea su PT, y desactivarlo desactiva el PT: cambia el inventario.
    void qc.invalidateQueries({ queryKey: ['inventario'] })
  }
  const guardarEstandar = useMutation({
    mutationFn: () =>
      mfrApi.actualizarEstandar(estandarDe!.id, {
        cajasPorHora: formEstandar.cajasPorHora ? Number(formEstandar.cajasPorHora) : null,
        pesoNetoKg: formEstandar.pesoNetoKg ? Number(formEstandar.pesoNetoKg) : null,
        motivo: formEstandar.motivo,
      }),
    onSuccess: () => {
      invalidar()
      setEstandarDe(null)
    },
  })

  /** Familias ya usadas en el catálogo, para sugerirlas en el formulario. */
  const familias = useMemo(
    () => [...new Set((productos.data ?? []).map((p) => p.subdescripcion).filter((f): f is string => Boolean(f)))].sort(),
    [productos.data],
  )
  const productoEnEdicion = editando && editando !== 'nuevo' ? editando : null
  const esquema = useMemo(() => construirEsquema(productoEnEdicion), [productoEnEdicion])
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquema),
  })
  const sugerenciaPeso = estandares.data?.find((x) => x.productoId === productoEnEdicion?.id)?.pesoSugeridoKg ?? null
  const estandarTocado =
    productoEnEdicion !== null &&
    ((watch('cajasPorHora') || '') !== (productoEnEdicion.cajasPorHora?.toString() ?? '') ||
      (watch('pesoNetoKg') || '') !== (productoEnEdicion.pesoNetoKg?.toString() ?? ''))

  useEffect(() => {
    if (editando === 'nuevo') {
      reset({ codigo: '', descripcion: '', proceso: '', unidadesPorCaja: '', cajasPorEstiba: '', personasIdeal: '', subdescripcion: '', cajasPorHora: '', pesoNetoKg: '', motivoEstandar: '' })
    } else if (editando) {
      reset({
        codigo: editando.codigo,
        descripcion: editando.descripcion,
        proceso: editando.proceso ?? '',
        unidadesPorCaja: editando.unidadesPorCaja?.toString() ?? '',
        cajasPorEstiba: editando.cajasPorEstiba?.toString() ?? '',
        personasIdeal: editando.personasIdeal?.toString() ?? '',
        subdescripcion: editando.subdescripcion ?? '',
        cajasPorHora: editando.cajasPorHora?.toString() ?? '',
        pesoNetoKg: editando.pesoNetoKg?.toString() ?? '',
        motivoEstandar: '',
      })
    }
  }, [editando, reset])

  const guardar = useMutation({
    mutationFn: async (d: Salida) => {
      const { cajasPorHora, pesoNetoKg, motivoEstandar, ...base } = d
      const datos = { ...base, proceso: base.proceso || null, subdescripcion: base.subdescripcion || null }
      if (editando === 'nuevo') {
        // Al crear, los estándares entran de una vez (valor inicial, sin motivo) y la receta es obligatoria.
        return catalogoApi.crearProducto({ ...datos, cajasPorHora, pesoNetoKg, receta: recetaNueva })
      }
      const actualizado = await catalogoApi.actualizarProducto(editando!.id, datos)
      // Al editar, los estándares van por su propio endpoint (auditado con motivo).
      if (cambiaEstandar(editando!, { cajasPorHora, pesoNetoKg })) {
        await mfrApi.actualizarEstandar(editando!.id, { cajasPorHora, pesoNetoKg, motivo: motivoEstandar })
      }
      return actualizado
    },
    onSuccess: () => {
      invalidar()
      setEditando(null)
    },
  })

  const cambiarActivo = useMutation({
    mutationFn: (p: Producto) => catalogoApi.actualizarProducto(p.id, { activo: !p.activo }),
    onSuccess: invalidar,
  })

  return (
    <section className="space-y-6">
      {/* Barra de herramientas: búsqueda y acciones a la vista, sin caja. */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-60 flex-1">
          <Campo etiqueta="Buscar por código o descripción" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        {tienePermiso('catalogo.editar_estandares') && (
          <Link to="/admin/pesos">
            <Boton variante="secundario">Pesos por caja en lote</Boton>
          </Link>
        )}
        <Boton onClick={abrirNuevo}>+ Nuevo PT</Boton>
      </div>

      {productos.isError && <Alerta tipo="error">{comoErrorApi(productos.error).mensaje}</Alerta>}
      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      {/*
        Rediseño (usuario, 2026-10-05): eran 12 columnas en una tabla
        dentro de una caja. Ahora cada PT es una fila: la descripción se lee
        completa, los estándares bajan a una línea de datos y la receta
        queda como insignia (la falta de receta salta a la vista en ámbar).
      */}
      <Seccion
        titulo="Catálogo de PT"
        contador={productos.data?.length}
        descripcion="El mismo de remisiones y del DPP. Cada PT tiene su existencia en la pestaña Existencias."
        accion={sinReceta > 0 && <Badge tono="alerta">{sinReceta} sin receta</Badge>}
      >
        <ListaRegistros
          cargando={productos.isLoading}
          estaVacia={productos.data?.length === 0}
          claveAnimacion={texto}
          vacio={
            <EstadoVacio
              Icono={IconoCaja}
              titulo={texto ? 'Ningún PT coincide con la búsqueda' : 'Todavía no hay PT'}
              texto={texto ? 'Pruebe con otra parte del código o de la descripción.' : 'Cree el primero con su receta.'}
            />
          }
        >
          {productos.data?.map((p) => {
            const receta = recetaVigente.get(p.id)
            const faltaReceta = !receta && Boolean(resumenRecetas.data)
            return (
              <FilaRegistro
                key={p.id}
                tono={!p.activo ? undefined : faltaReceta ? 'alerta' : 'marca'}
                apagada={!p.activo}
                etiqueta={
                  <>
                    {!p.activo && <Badge tono="neutro">Inactivo</Badge>}
                    {p.proceso && <Badge tono="marca">{p.proceso}</Badge>}
                    {p.subdescripcion && <Badge tono="acento">{p.subdescripcion}</Badge>}
                  </>
                }
                titulo={p.descripcion}
                detalle={
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="cifra">{p.codigo}</span>
                    {receta ? (
                      <span className="text-xs">
                        Receta v{receta.version} · {receta.componentes} componentes
                      </span>
                    ) : (
                      faltaReceta && <Badge tono="alerta">Sin receta</Badge>
                    )}
                  </span>
                }
                meta={
                  <>
                    <MetaDato etiqueta="Unid/caja">{p.unidadesPorCaja ?? '—'}</MetaDato>
                    <MetaDato etiqueta="Cajas/estiba">{p.cajasPorEstiba ?? '—'}</MetaDato>
                    <MetaDato etiqueta="Línea ideal">{p.personasIdeal ?? '—'} pers.</MetaDato>
                    <MetaDato etiqueta="Cajas/h">{p.cajasPorHora ?? '—'}</MetaDato>
                    <MetaDato etiqueta="Kg/caja">{p.pesoNetoKg ?? '—'}</MetaDato>
                  </>
                }
                acciones={
                  <>
                    {tienePermiso('inventario.consultar') && (
                      <Boton variante={faltaReceta ? 'primario' : 'secundario'} tamano="sm" onClick={() => setRecetaDe(p)}>
                        Receta
                      </Boton>
                    )}
                    {tienePermiso('catalogo.editar_estandares') && (
                      <Boton variante="secundario" tamano="sm" onClick={() => abrirEstandar(p)}>
                        Estándar
                      </Boton>
                    )}
                    <Boton variante="secundario" tamano="sm" onClick={() => setEditando(p)}>
                      Editar
                    </Boton>
                    <Boton variante="sutil" tamano="sm" onClick={() => cambiarActivo.mutate(p)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
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
        titulo={editando === 'nuevo' ? 'Nuevo PT' : 'Editar PT'}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={(e) => void handleSubmit((d) => guardar.mutate(d))(e)} noValidate className="space-y-4">
          <Campo etiqueta="Código (ítem)" error={errors.codigo?.message} {...register('codigo')} />
          <Campo etiqueta="Descripción" error={errors.descripcion?.message} {...register('descripcion')} />
          <Select etiqueta="Proceso" error={errors.proceso?.message} {...register('proceso')}>
            <option value="">Sin definir</option>
            {PROCESOS_PRODUCTO.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Unidades por caja" type="number" min={1} error={errors.unidadesPorCaja?.message} {...register('unidadesPorCaja')} />
            <Campo etiqueta="Cajas por estiba" type="number" min={1} error={errors.cajasPorEstiba?.message} {...register('cajasPorEstiba')} />
            <Campo etiqueta="Línea ideal (personas)" type="number" min={0} error={errors.personasIdeal?.message} {...register('personasIdeal')} />
            <div>
              <Campo etiqueta="Subdescripción (familia)" list="familias-producto" placeholder="SURTIDO, OFERTA, REEMPAQUE…" error={errors.subdescripcion?.message} {...register('subdescripcion')} />
              <datalist id="familias-producto">
                {familias.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
          </div>
          <fieldset className="space-y-3 rounded-md border border-borde p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-tinta-suave">Estándar de producción (MFR)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Cajas por hora (hoja TIEMPOS)" type="number" min={0.01} step="0.01" error={errors.cajasPorHora?.message} {...register('cajasPorHora')} />
              <Campo etiqueta="Peso neto por caja (kg)" type="number" min={0.001} step="0.001" error={errors.pesoNetoKg?.message} {...register('pesoNetoKg')} />
            </div>
            {sugerenciaPeso !== null && (
              <p className="text-xs text-tinta-suave">
                Según la descripción el peso sería <strong>{sugerenciaPeso} kg</strong>.{' '}
                <button type="button" className="text-marca hover:underline" onClick={() => setValue('pesoNetoKg', String(sugerenciaPeso), { shouldDirty: true })}>
                  Usar sugerido
                </button>
              </p>
            )}
            {estandarTocado && (
              <Campo
                etiqueta="Motivo del cambio de estándar (obligatorio)"
                placeholder="Ej.: medición de tiempos de septiembre"
                error={errors.motivoEstandar?.message}
                {...register('motivoEstandar')}
              />
            )}
            {editando === 'nuevo' && (
              <p className="text-xs text-tinta-suave">Al crear no hace falta motivo: es el valor inicial. Después, cambiarlos queda auditado con motivo.</p>
            )}
          </fieldset>
          {editando === 'nuevo' && (
            <fieldset className="space-y-3 rounded-md border border-borde p-3">
              <legend className="px-1 text-xs font-semibold uppercase text-tinta-suave">Receta: PI e insumos que lleva (obligatoria)</legend>
              <EditorReceta componentes={recetaNueva} onCambiar={setRecetaNueva} />
            </fieldset>
          )}
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending} disabled={editando === 'nuevo' && !recetaValida(recetaNueva)}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>

      {recetaDe && <RecetaDialogo producto={recetaDe} onCerrar={() => setRecetaDe(null)} />}

      <Dialogo
        abierto={estandarDe !== null}
        titulo={`Estándar de producción — ${estandarDe?.codigo ?? ''}`}
        onCerrar={() => setEstandarDe(null)}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); guardarEstandar.mutate() }}
          className="space-y-4"
        >
          <p className="text-sm text-tinta-suave">
            <strong>Cajas por hora</strong> al 100 % (columna CAJAS POR HORA de la hoja TIEMPOS; es el valor por defecto al armar bloques a mano) y{' '}
            <strong>peso neto por caja</strong> en kilos para pasar cajas a kilogramos. Cada cambio queda auditado con su motivo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cajas por hora" type="number" min={0.01} step="0.01" value={formEstandar.cajasPorHora} onChange={(e) => setFormEstandar({ ...formEstandar, cajasPorHora: e.target.value })} />
            <Campo etiqueta="Peso neto por caja (kg)" type="number" min={0.001} step="0.001" value={formEstandar.pesoNetoKg} onChange={(e) => setFormEstandar({ ...formEstandar, pesoNetoKg: e.target.value })} />
          </div>
          {estandarActual?.pesoSugeridoKg != null && (
            <p className="text-xs text-tinta-suave">
              Según la descripción ({estandarDe?.descripcion}) el peso sería <strong>{estandarActual.pesoSugeridoKg} kg</strong>.{' '}
              <button type="button" className="text-marca hover:underline" onClick={() => setFormEstandar({ ...formEstandar, pesoNetoKg: String(estandarActual.pesoSugeridoKg) })}>
                Usar sugerido
              </button>
            </p>
          )}
          <Campo etiqueta="Motivo del cambio (obligatorio)" placeholder="Ej.: medición de tiempos de septiembre" value={formEstandar.motivo} onChange={(e) => setFormEstandar({ ...formEstandar, motivo: e.target.value })} />
          {guardarEstandar.isError && <Alerta tipo="error">{comoErrorApi(guardarEstandar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEstandarDe(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardarEstandar.isPending} disabled={formEstandar.motivo.trim().length < 5}>Guardar estándar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
