/**
 * FORMULARIO DE REMISIÓN (crear y editar)
 * =======================================
 *
 * Validación con Zod espejo de las reglas de la entidad del backend.
 * Ayudas al coordinador:
 *   - Al elegir producto y escribir cajas, se sugieren estibas completas,
 *     cajas sueltas y unidades usando `cajasPorEstiba` y `unidadesPorCaja`
 *     del catálogo. Son sugerencias: se pueden sobrescribir.
 *   - Los números de estiba se escriben separados por coma o espacio.
 *   - El selector de producto solo ofrece los SKU del DPP del día (tope:
 *     "ni una caja más de lo programado", área 2026-09-18), con lo que
 *     queda por remisionar. Marcar "extraoficial" (pedido de emergencia)
 *     va PRIMERO y despliega el catálogo completo (área 2026-09-21).
 *
 * En modo edición la fecha operativa NO cambia (es la del registro
 * original), así que el vencimiento se compara contra ella.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { Producto } from '../../../shared/types/catalogo'
import type { CrearRemisionDatos, Remision } from '../../../shared/types/remision'
import {
  useLugares,
  useProductos,
  useGrupos,
  useTurnos,
} from '../../catalogo/hooks/useCatalogos'
import { useIndicadoresDia } from '../../mfr/hooks/useMfr'

const entero = (min: number, mensaje: string) =>
  z.coerce.number({ message: 'Debe ser un número.' }).int('Debe ser entero.').min(min, mensaje)

function construirEsquema(fechaOperativa: string) {
  return z
    .object({
      turnoId: z.string().min(1, 'Seleccione el turno.'),
      grupoId: z.string().min(1, 'Seleccione el grupo.'),
      lugarId: z.string().min(1, 'Seleccione el lugar.'),
      productoId: z.string().min(1, 'Seleccione el producto.'),
      fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese la fecha de vencimiento.'),
      cantidadCajas: entero(1, 'Debe haber al menos una caja.'),
      cantidadUnidades: entero(1, 'Debe haber al menos una unidad.'),
      estibasCompletas: entero(0, 'No puede ser negativo.'),
      cajasSueltas: entero(0, 'No puede ser negativo.'),
      numerosEstiba: z.string(),
      observaciones: z.string().max(500, 'Máximo 500 caracteres.'),
      extraoficial: z.boolean(),
      motivoExtraoficial: z.string().max(500, 'Máximo 500 caracteres.'),
    })
    .refine((d) => !d.extraoficial || d.motivoExtraoficial.trim().length >= 5, {
      message: 'Indique el motivo del pedido de emergencia (mínimo 5 caracteres).',
      path: ['motivoExtraoficial'],
    })
    .refine((d) => d.estibasCompletas > 0 || d.cajasSueltas > 0, {
      message: 'Debe haber al menos una estiba completa o una caja suelta.',
      path: ['estibasCompletas'],
    })
    .refine((d) => d.fechaVencimiento > fechaOperativa, {
      message: `El vencimiento debe ser posterior a la fecha operativa (${fechaOperativa}).`,
      path: ['fechaVencimiento'],
    })
    .superRefine((d, ctx) => {
      const numeros = parsearEstibas(d.numerosEstiba)
      if (numeros === null) {
        ctx.addIssue({ code: 'custom', path: ['numerosEstiba'], message: 'Solo números enteros positivos separados por coma.' })
      } else if (new Set(numeros).size !== numeros.length) {
        ctx.addIssue({ code: 'custom', path: ['numerosEstiba'], message: 'Hay números de estiba repetidos.' })
      }
    })
}

type Esquema = ReturnType<typeof construirEsquema>
type Entrada = z.input<Esquema>
type Salida = z.output<Esquema>

/** "31, 32 33" → [31, 32, 33]; null si algo no es entero positivo. */
function parsearEstibas(texto: string): number[] | null {
  const partes = texto.split(/[\s,;]+/).filter(Boolean)
  const numeros = partes.map(Number)
  return numeros.every((n) => Number.isInteger(n) && n > 0) ? numeros : null
}

interface Props {
  /** Fecha operativa contra la que se valida el vencimiento (YYYY-MM-DD). */
  fechaOperativa: string
  /** Si viene, el formulario arranca con estos valores (modo edición). */
  inicial?: Remision
  /** Texto del botón de envío. */
  textoEnviar: string
  enviando: boolean
  error: unknown
  onEnviar: (datos: CrearRemisionDatos) => Promise<void>
  onCancelar: () => void
}

export function RemisionForm({ fechaOperativa, inicial, textoEnviar, enviando, error, onEnviar, onCancelar }: Props) {
  const turnos = useTurnos()
  const grupos = useGrupos()
  const lugares = useLugares()
  const productos = useProductos({ soloActivos: true })
  const [busquedaProducto, setBusquedaProducto] = useState('')

  const esquema = useMemo(() => construirEsquema(fechaOperativa), [fechaOperativa])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquema),
    defaultValues: inicial
      ? {
          turnoId: inicial.turnoId,
          grupoId: inicial.grupoId,
          lugarId: inicial.lugarId,
          productoId: inicial.producto.id,
          fechaVencimiento: inicial.fechaVencimiento,
          cantidadCajas: inicial.cantidadCajas,
          cantidadUnidades: inicial.cantidadUnidades,
          estibasCompletas: inicial.estibasCompletas,
          cajasSueltas: inicial.cajasSueltas,
          numerosEstiba: inicial.numerosEstiba.join(', '),
          observaciones: inicial.observaciones ?? '',
          extraoficial: inicial.extraoficial,
          motivoExtraoficial: inicial.motivoExtraoficial ?? '',
        }
      : {
          turnoId: '',
          grupoId: '',
          lugarId: '',
          productoId: '',
          fechaVencimiento: '',
          cantidadCajas: 0,
          cantidadUnidades: 0,
          estibasCompletas: 0,
          cajasSueltas: 0,
          numerosEstiba: '',
          observaciones: '',
          extraoficial: false,
          motivoExtraoficial: '',
        },
  })

  // Al crear, si solo hay un lugar (hoy: Maquila PepsiCo Santo Domingo), se preselecciona.
  useEffect(() => {
    if (!inicial && lugares.data?.length === 1) setValue('lugarId', lugares.data[0].id)
  }, [inicial, lugares.data, setValue])

  const productoId = watch('productoId')
  const cantidadCajas = watch('cantidadCajas')
  const extraoficial = watch('extraoficial')
  const producto = productos.data?.find((p) => p.id === productoId)

  // Lo que el DPP programó hoy para el producto: guía para no pasarse del tope.
  const dia = useIndicadoresDia(fechaOperativa)
  const programadoHoy = dia.data?.mfr.porProducto.find((p) => p.productoId === productoId)
  const hayDpp = (dia.data?.bloques.length ?? 0) > 0

  /**
   * Cálculo asistido. En edición NO se dispara al cargar (respetaría lo
   * que el coordinador ya había escrito): solo cuando cambian producto o
   * cajas respecto al valor anterior.
   */
  const ultimo = useRef<{ producto?: Producto; cajas?: unknown }>({
    producto: undefined,
    cajas: inicial?.cantidadCajas,
  })
  useEffect(() => {
    const cajas = Number(cantidadCajas)
    const cambio = ultimo.current.producto !== producto || ultimo.current.cajas !== cantidadCajas
    const primeraVezEnEdicion = inicial && ultimo.current.producto === undefined
    ultimo.current = { producto, cajas: cantidadCajas }
    if (!producto || !cambio || primeraVezEnEdicion) return
    if (!Number.isInteger(cajas) || cajas <= 0) return
    if (producto.cajasPorEstiba) {
      setValue('estibasCompletas', Math.floor(cajas / producto.cajasPorEstiba))
      setValue('cajasSueltas', cajas % producto.cajasPorEstiba)
    }
    if (producto.unidadesPorCaja) {
      setValue('cantidadUnidades', cajas * producto.unidadesPorCaja)
    }
  }, [producto, cantidadCajas, setValue, inicial])

  /**
   * Regla del área (2026-09-21): la remisión se ajusta al DPP. Sin la
   * marca de extraoficial solo se ofrecen los SKU programados ese día;
   * con la marca, el catálogo completo. En edición, el producto actual
   * se conserva en la lista aunque no cumpla el filtro.
   */
  const programadosHoy = useMemo(
    () => new Map((dia.data?.mfr.porProducto ?? []).map((p) => [p.productoId, p])),
    [dia.data],
  )
  const productosFiltrados = useMemo(() => {
    const t = busquedaProducto.trim().toLowerCase()
    const lista = productos.data ?? []
    return lista.filter(
      (p) =>
        p.id === productoId ||
        ((extraoficial || programadosHoy.has(p.id)) &&
          (!t || p.codigo.toLowerCase().includes(t) || p.descripcion.toLowerCase().includes(t))),
    )
  }, [productos.data, busquedaProducto, productoId, extraoficial, programadosHoy])

  // Si se quita la marca y el producto elegido no está en el DPP, se limpia la selección.
  useEffect(() => {
    if (!extraoficial && productoId && dia.data && !programadosHoy.has(productoId) && productoId !== inicial?.producto.id) {
      setValue('productoId', '')
    }
  }, [extraoficial, productoId, dia.data, programadosHoy, inicial, setValue])

  const etiquetaProducto = (p: Producto) => {
    const prog = programadosHoy.get(p.id)
    if (!prog || extraoficial) return `${p.codigo} · ${p.descripcion}`
    const quedan = Math.max(0, prog.programadoCajas - prog.producidoCajas)
    return `${p.codigo} · ${p.descripcion} — quedan ${quedan} de ${prog.programadoCajas} cajas`
  }

  const enviar = handleSubmit(async (datos) => {
    await onEnviar({
      turnoId: datos.turnoId,
      grupoId: datos.grupoId,
      lugarId: datos.lugarId,
      productoId: datos.productoId,
      fechaVencimiento: datos.fechaVencimiento,
      cantidadCajas: datos.cantidadCajas,
      cantidadUnidades: datos.cantidadUnidades,
      estibasCompletas: datos.estibasCompletas,
      cajasSueltas: datos.cajasSueltas,
      numerosEstiba: parsearEstibas(datos.numerosEstiba) ?? [],
      observaciones: datos.observaciones.trim() || undefined,
      extraoficial: datos.extraoficial,
      motivoExtraoficial: datos.extraoficial ? datos.motivoExtraoficial.trim() : undefined,
    })
  })

  return (
    <form onSubmit={(e) => void enviar(e)} noValidate className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
      {productos.data?.length === 0 && (
        <Alerta tipo="info">
          El catálogo de productos está vacío. Un administrador debe crear productos antes de
          registrar remisiones.
        </Alerta>
      )}

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Contexto</legend>
        <Select etiqueta="Turno" error={errors.turnoId?.message} {...register('turnoId')}>
          <option value="">Seleccione…</option>
          {turnos.data?.filter((t) => t.activo).map((t) => (
            <option key={t.id} value={t.id}>{t.codigo} · {t.nombre}</option>
          ))}
        </Select>
        <Select etiqueta="Grupo (personal del turno)" error={errors.grupoId?.message} {...register('grupoId')}>
          <option value="">Seleccione…</option>
          {grupos.data?.filter((p) => p.activo).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </Select>
        <Select etiqueta="Lugar" error={errors.lugarId?.message} {...register('lugarId')}>
          <option value="">Seleccione…</option>
          {lugares.data?.filter((l) => l.activo).map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </Select>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
        <legend className="px-1 text-sm font-semibold text-amber-800">Pedido de emergencia (fuera del DPP)</legend>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5" {...register('extraoficial')} />
          <span>
            Remisión <strong>extraoficial</strong>: PepsiCo la pidió por fuera del schedule. Al marcarla se habilita el catálogo
            completo de productos; no cuenta para el MFR ni para el tope de lo programado del día, y queda auditada con su motivo.
          </span>
        </label>
        {extraoficial && (
          <Campo
            etiqueta="Motivo (obligatorio)"
            placeholder="Ej.: pedido de emergencia del OPA Carlos, 14:30"
            error={errors.motivoExtraoficial?.message}
            {...register('motivoExtraoficial')}
          />
        )}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-slate-700">
          Producto {extraoficial ? '(catálogo completo)' : `(solo lo programado en el DPP del ${fechaOperativa})`}
        </legend>
        {!extraoficial && dia.data && !hayDpp && (
          <Alerta tipo="error">
            El {fechaOperativa} no tiene programación (DPP) cargada: no hay productos para remisionar salvo como pedido de emergencia.
          </Alerta>
        )}
        <Campo
          etiqueta="Buscar por código o descripción"
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
          placeholder="300058141 o LONCHERA"
        />
        <Select etiqueta="Producto" error={errors.productoId?.message} {...register('productoId')}>
          <option value="">{dia.isLoading && !extraoficial ? 'Cargando el DPP…' : 'Seleccione…'}</option>
          {productosFiltrados.map((p) => (
            <option key={p.id} value={p.id}>{etiquetaProducto(p)}</option>
          ))}
        </Select>
        {producto && (
          <p className="text-xs text-slate-500">
            Empaque: {producto.unidadesPorCaja ?? '?'} unidades/caja · {producto.cajasPorEstiba ?? '?'} cajas/estiba
            {producto.proceso && ` · proceso ${producto.proceso}`}
          </p>
        )}
        {producto && dia.data && !extraoficial && hayDpp && (
          programadoHoy ? (
            <p className="text-xs text-slate-600">
              DPP del {fechaOperativa}: programadas <strong>{programadoHoy.programadoCajas}</strong> cajas, aprobadas{' '}
              <strong>{programadoHoy.producidoCajas}</strong> → quedan{' '}
              <strong>{Math.max(0, programadoHoy.programadoCajas - programadoHoy.producidoCajas)}</strong> por remisionar.
            </p>
          ) : (
            <Alerta tipo="error">
              Este producto no está en el DPP del {fechaOperativa}. Solo se puede remisionar como pedido de emergencia.
            </Alerta>
          )
        )}
        <Campo
          etiqueta="Fecha de vencimiento"
          type="date"
          error={errors.fechaVencimiento?.message}
          {...register('fechaVencimiento')}
        />
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-700">Cantidades</legend>
        <Campo etiqueta="Cajas" type="number" min={1} error={errors.cantidadCajas?.message} {...register('cantidadCajas')} />
        <Campo etiqueta="Unidades" type="number" min={1} error={errors.cantidadUnidades?.message} {...register('cantidadUnidades')} />
        <Campo etiqueta="Estibas completas" type="number" min={0} error={errors.estibasCompletas?.message} {...register('estibasCompletas')} />
        <Campo etiqueta="Cajas sueltas" type="number" min={0} error={errors.cajasSueltas?.message} {...register('cajasSueltas')} />
        <div className="md:col-span-2">
          <Campo
            etiqueta="Números de estiba (separados por coma)"
            placeholder="31, 32, 33"
            error={errors.numerosEstiba?.message}
            {...register('numerosEstiba')}
          />
        </div>
        <div className="md:col-span-2">
          <AreaTexto etiqueta="Observaciones" rows={2} error={errors.observaciones?.message} {...register('observaciones')} />
        </div>
      </fieldset>

      {Boolean(error) && <Alerta tipo="error">{comoErrorApi(error).mensaje}</Alerta>}

      <div className="flex justify-end gap-2">
        <Boton type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={isSubmitting || enviando}>
          {textoEnviar}
        </Boton>
      </div>
    </form>
  )
}
