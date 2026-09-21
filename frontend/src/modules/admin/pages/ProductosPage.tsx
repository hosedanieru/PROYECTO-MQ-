/**
 * ADMINISTRACIÓN DE PRODUCTOS
 * ===========================
 *
 * Carga manual uno a uno (decisión del 2026-09-16). Sin "eliminar": un
 * producto referenciado por remisiones se desactiva y deja de ofrecerse.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { PROCESOS_PRODUCTO, type Producto } from '../../../shared/types/catalogo'
import { useSesion } from '../../auth/useSesion'
import { catalogoApi } from '../../catalogo/api/catalogo.api'
import { useProductos } from '../../catalogo/hooks/useCatalogos'
import { mfrApi } from '../../mfr/api/mfr.api'
import { useEstandares } from '../../mfr/hooks/useMfr'

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

  const abrirEstandar = (p: Producto) => {
    setFormEstandar({ cajasPorHora: p.cajasPorHora?.toString() ?? '', pesoNetoKg: p.pesoNetoKg?.toString() ?? '', motivo: '' })
    setEstandarDe(p)
  }
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ['productos'] })
    void qc.invalidateQueries({ queryKey: ['mfr'] })
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
        // Al crear, los estándares entran de una vez (valor inicial, sin motivo).
        return catalogoApi.crearProducto({ ...datos, cajasPorHora, pesoNetoKg })
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
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Productos</h1>
        <Boton onClick={() => setEditando('nuevo')}>Nuevo producto</Boton>
      </header>

      <Campo
        etiqueta="Buscar por código o descripción"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      {productos.isError && <Alerta tipo="error">{comoErrorApi(productos.error).mensaje}</Alerta>}
      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Proceso</th>
              <th className="px-4 py-2">Familia</th>
              <th className="px-4 py-2 text-right">Unid/caja</th>
              <th className="px-4 py-2 text-right">Cajas/estiba</th>
              <th className="px-4 py-2 text-right" title="Línea ideal: personas necesarias">Pers.</th>
              <th className="px-4 py-2 text-right">Cajas/h</th>
              <th className="px-4 py-2 text-right">Kg/caja</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {productos.data?.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500">Sin productos.</td></tr>
            )}
            {productos.data?.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'text-slate-400'}>
                <td className="px-4 py-2 font-mono">{p.codigo}</td>
                <td className="px-4 py-2">{p.descripcion}</td>
                <td className="px-4 py-2">{p.proceso ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{p.subdescripcion ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.unidadesPorCaja ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.cajasPorEstiba ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.personasIdeal ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.cajasPorHora ?? '—'}</td>
                <td className="px-4 py-2 text-right">{p.pesoNetoKg ?? '—'}</td>
                <td className="px-4 py-2">{p.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {tienePermiso('catalogo.editar_estandares') && (
                    <button className="mr-3 text-slate-600 hover:underline" onClick={() => abrirEstandar(p)}>Estándar</button>
                  )}
                  <button className="text-marca hover:underline" onClick={() => setEditando(p)}>Editar</button>
                  <button className="ml-3 text-slate-600 hover:underline" onClick={() => cambiarActivo.mutate(p)}>
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
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
          <fieldset className="space-y-3 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-slate-500">Estándar de producción (MFR)</legend>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Cajas por hora (hoja TIEMPOS)" type="number" min={0.01} step="0.01" error={errors.cajasPorHora?.message} {...register('cajasPorHora')} />
              <Campo etiqueta="Peso neto por caja (kg)" type="number" min={0.001} step="0.001" error={errors.pesoNetoKg?.message} {...register('pesoNetoKg')} />
            </div>
            {sugerenciaPeso !== null && (
              <p className="text-xs text-slate-600">
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
              <p className="text-xs text-slate-500">Al crear no hace falta motivo: es el valor inicial. Después, cambiarlos queda auditado con motivo.</p>
            )}
          </fieldset>
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>

      <Dialogo
        abierto={estandarDe !== null}
        titulo={`Estándar de producción — ${estandarDe?.codigo ?? ''}`}
        onCerrar={() => setEstandarDe(null)}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); guardarEstandar.mutate() }}
          className="space-y-4"
        >
          <p className="text-sm text-slate-600">
            <strong>Cajas por hora</strong> al 100 % (columna CAJAS POR HORA de la hoja TIEMPOS; es el valor por defecto al armar bloques a mano) y{' '}
            <strong>peso neto por caja</strong> en kilos para pasar cajas a kilogramos. Cada cambio queda auditado con su motivo.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Cajas por hora" type="number" min={0.01} step="0.01" value={formEstandar.cajasPorHora} onChange={(e) => setFormEstandar({ ...formEstandar, cajasPorHora: e.target.value })} />
            <Campo etiqueta="Peso neto por caja (kg)" type="number" min={0.001} step="0.001" value={formEstandar.pesoNetoKg} onChange={(e) => setFormEstandar({ ...formEstandar, pesoNetoKg: e.target.value })} />
          </div>
          {estandarActual?.pesoSugeridoKg != null && (
            <p className="text-xs text-slate-600">
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
