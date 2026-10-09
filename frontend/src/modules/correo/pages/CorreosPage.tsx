/**
 * ADMINISTRACIÓN — CORREOS
 * ========================
 *
 * Listas de distribución (usuario, 2026-10-03): "Jefes", "PepsiCo",
 * "Turno T2"… Se eligen al enviar remisiones por correo y, en la fase 2,
 * arman el envío automático al cerrar el turno:
 *   - lista general con "incluir en cierres": va en todos;
 *   - lista de un turno: va cuando ese turno es el siguiente.
 * Cada lista dice QUÉ recibe: las remisiones aprobadas (PepsiCo), el
 * resumen del turno (jefes, coordinadores) o ambos.
 * Abajo, el registro de los envíos de los últimos 7 días (enviados y fallidos).
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { AreaTexto } from '../../../components/AreaTexto'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoCorreo } from '../../../components/Iconos'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { LineaTiempo, type GrupoTiempo } from '../../../components/LineaTiempo'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { PantallaCargando } from '../../../components/PantallaCargando'
import { Seccion } from '../../../components/Seccion'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import { ETIQUETA_RECIBE, type ListaDistribucion, type RecibeLista } from '../../../shared/types/correo'
import { agruparEnOrden } from '../../../shared/utils/agrupar'
import { diaLargo, fechaOperativaDe, hora } from '../../../shared/utils/fechas'
import { useTurnos } from '../../catalogo/hooks/useCatalogos'
import { useEnviosCorreo, useGuardarLista, useListasDistribucion } from '../hooks/useCorreo'

interface Form {
  nombre: string
  recibe: RecibeLista
  turnoId: string
  incluirEnCierres: boolean
  correos: string
}
const VACIO: Form = {
  nombre: '',
  recibe: 'REMISIONES',
  turnoId: '',
  incluirEnCierres: true,
  correos: '',
}
const correosDeTexto = (texto: string) =>
  texto
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(Boolean)

/** Hace 6 días operativos, en YYYY-MM-DD (fechas de solo día en UTC). */
function haceSeisDias(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - 6)).toISOString().slice(0, 10)
}

export function CorreosPage() {
  const listas = useListasDistribucion()
  const turnos = useTurnos()
  const guardar = useGuardarLista()
  const hoy = fechaOperativaDe(new Date())
  const envios = useEnviosCorreo(haceSeisDias(hoy), hoy)
  const [editando, setEditando] = useState<ListaDistribucion | 'nueva' | null>(null)
  const [form, setForm] = useState<Form>(VACIO)

  const codigoTurno = (id: string | null) => turnos.data?.find((t) => t.id === id)?.codigo ?? id
  const fallidos = (envios.data ?? []).filter((e) => e.estado !== 'ENVIADO').length
  // Envíos agrupados por día operativo del instante en que salieron (corte 06:00).
  const gruposEnvios: GrupoTiempo[] = agruparEnOrden(envios.data ?? [], (e) => fechaOperativaDe(new Date(e.fechaHora))).map(
    (g): GrupoTiempo => ({
      clave: g.clave,
      titulo: diaLargo(g.clave),
      resumen: `${g.elementos.length} ${g.elementos.length === 1 ? 'envío' : 'envíos'}`,
      eventos: g.elementos.map((e) => ({
        clave: e.id,
        tono: e.estado === 'ENVIADO' ? 'exito' : 'critico',
        contenido: (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tono={e.estado === 'ENVIADO' ? 'exito' : 'critico'}>{e.estado === 'ENVIADO' ? 'Enviado' : 'Falló'}</Badge>
              <span className="cifra text-sm font-bold text-tinta">{hora(e.fechaHora)}</span>
              <span className="text-[1rem] font-bold text-tinta">{e.asunto}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-suave">
              <MetaDato etiqueta="Origen">
                {e.origen === 'MANUAL' ? `a mano por ${e.usuarioNombre}` : 'automático al cerrar el turno'}
              </MetaDato>
              <MetaDato etiqueta="Destinatarios">{e.destinatarios.length}</MetaDato>
            </div>
            {e.error && <p className="mt-1.5 text-sm text-critico">{e.error}</p>}
          </div>
        ),
      })),
    }),
  )

  const abrir = (l: ListaDistribucion | 'nueva') => {
    setForm(
      l === 'nueva'
        ? VACIO
        : {
            nombre: l.nombre,
            recibe: l.recibe,
            turnoId: l.turnoId ?? '',
            incluirEnCierres: l.incluirEnCierres,
            correos: l.correos.join('\n'),
          },
    )
    guardar.reset()
    setEditando(l)
  }

  const enviar = () =>
    guardar.mutate(
      {
        id: editando === 'nueva' ? undefined : (editando as ListaDistribucion).id,
        datos: {
          nombre: form.nombre.trim(),
          recibe: form.recibe,
          turnoId: form.turnoId || null,
          incluirEnCierres: !form.turnoId && form.incluirEnCierres,
          correos: correosDeTexto(form.correos),
        },
      },
      { onSuccess: () => setEditando(null) },
    )

  return (
    <section className="mx-auto max-w-5xl space-y-7">
      <EncabezadoPagina
        Icono={IconoCorreo}
        escena="correo"
        titulo="Correos"
        descripcion="Listas de destinatarios para las remisiones y el resumen del turno, y registro de lo enviado."
        acciones={
          <Boton variante="claro" onClick={() => abrir('nueva')}>
            + Nueva lista
          </Boton>
        }
      />

      {guardar.isError && editando === null && (
        <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>
      )}

      <Seccion
        titulo="Listas de distribución"
        contador={listas.data?.length}
        descripcion="Generales (Jefes, PepsiCo) y por turno. Las de un turno reciben el envío automático cuando ese turno es el siguiente."
      >
        <ListaRegistros
          cargando={listas.isLoading}
          estaVacia={listas.data?.length === 0}
          vacio={
            <EstadoVacio
              Icono={IconoCorreo}
              titulo="Todavía no hay listas"
              texto='Cree "Jefes", "PepsiCo" y una por turno.'
              accion={<Boton onClick={() => abrir('nueva')}>+ Nueva lista</Boton>}
            />
          }
        >
          {listas.data?.map((l) => (
            <FilaRegistro
              key={l.id}
              tono={!l.activo ? undefined : l.turnoId ? 'marca' : l.incluirEnCierres ? 'exito' : 'neutro'}
              apagada={!l.activo}
              etiqueta={
                <>
                  {l.turnoId ? (
                    <Badge tono="marca">Turno {codigoTurno(l.turnoId)}</Badge>
                  ) : l.incluirEnCierres ? (
                    <Badge tono="exito">En todos los cierres</Badge>
                  ) : (
                    <Badge tono="neutro">Solo a mano</Badge>
                  )}
                  {!l.activo && <Badge tono="neutro">Inactiva</Badge>}
                </>
              }
              titulo={l.nombre}
              detalle={`Recibe: ${ETIQUETA_RECIBE[l.recibe]}`}
              meta={l.correos.map((c) => (
                <span key={c} className="rounded-full bg-velo px-2.5 py-0.5 font-medium text-tinta">
                  {c}
                </span>
              ))}
              cifra={l.correos.length}
              notaCifra={l.correos.length === 1 ? 'destinatario' : 'destinatarios'}
              acciones={
                <>
                  <Boton variante="secundario" tamano="sm" onClick={() => abrir(l)}>
                    Editar
                  </Boton>
                  <Boton variante="sutil" tamano="sm" onClick={() => guardar.mutate({ id: l.id, datos: { activo: !l.activo } })}>
                    {l.activo ? 'Desactivar' : 'Activar'}
                  </Boton>
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>

      <Seccion
        titulo="Envíos de los últimos 7 días"
        contador={envios.data?.length}
        tono={fallidos > 0 ? 'critico' : 'exito'}
        accion={fallidos > 0 && <Badge tono="critico">{fallidos} fallidos</Badge>}
      >
        {envios.isLoading ? (
          <PantallaCargando />
        ) : (envios.data ?? []).length === 0 ? (
          <EstadoVacio Icono={IconoCorreo} titulo="Sin envíos en estos días" />
        ) : (
          <LineaTiempo grupos={gruposEnvios} />
        )}
      </Seccion>

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nueva' ? 'Nueva lista' : 'Editar lista'}
        onCerrar={() => setEditando(null)}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <Campo
            etiqueta="Nombre"
            maxLength={60}
            placeholder="Jefes, PepsiCo, Turno T2…"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Select
            etiqueta="Qué recibe al cerrar el turno"
            value={form.recibe}
            onChange={(e) => setForm({ ...form, recibe: e.target.value as RecibeLista })}
          >
            {(Object.keys(ETIQUETA_RECIBE) as RecibeLista[]).map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_RECIBE[r]}
              </option>
            ))}
          </Select>
          <Select
            etiqueta="Turno"
            value={form.turnoId}
            onChange={(e) => setForm({ ...form, turnoId: e.target.value })}
          >
            <option value="">Ninguno (lista general)</option>
            {turnos.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} · {t.nombre}
              </option>
            ))}
          </Select>
          {!form.turnoId && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.incluirEnCierres}
                onChange={(e) => setForm({ ...form, incluirEnCierres: e.target.checked })}
              />
              Incluir en todos los envíos automáticos al cerrar el turno
            </label>
          )}
          <AreaTexto
            etiqueta="Correos (uno por línea)"
            rows={5}
            value={form.correos}
            onChange={(e) => setForm({ ...form, correos: e.target.value })}
          />
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton
              type="submit"
              cargando={guardar.isPending}
              disabled={!form.nombre.trim() || correosDeTexto(form.correos).length === 0}
            >
              Guardar
            </Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}
