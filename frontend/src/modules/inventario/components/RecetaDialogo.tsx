/**
 * RECETA DE UN PT — botón "Receta" de la lista de PT
 * ==================================================
 *
 * Muestra la versión vigente para corregirla y el historial. Guardar NO
 * edita encima: crea la versión siguiente (usuario, 2026-09-29), así el
 * consumo de una remisión pasada se calcula con la receta que regía.
 */

import { useState } from 'react'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Dialogo } from '../../../components/Dialogo'
import { comoErrorApi } from '../../../services/http'
import type { ComponenteReceta, RecetaPt } from '../../../shared/types/inventario'
import { fechaHora } from '../../../shared/utils/fechas'
import { useSesion } from '../../auth/useSesion'
import { useGuardarReceta, useReceta } from '../hooks/useInventario'
import { recetaValida, textoEquivalenciaReceta } from '../receta'
import { EditorReceta } from './EditorReceta'

interface Props {
  producto: { id: string; codigo: string; descripcion: string }
  onCerrar: () => void
}

export function RecetaDialogo({ producto, onCerrar }: Props) {
  const receta = useReceta(producto.id)
  const vigente = receta.data?.vigente ?? null

  return (
    <Dialogo abierto titulo={`Receta · ${producto.codigo}`} onCerrar={onCerrar}>
      <div className="space-y-4">
        <p className="text-sm text-tinta-suave">{producto.descripcion}</p>
        {receta.isError && <Alerta tipo="error">{comoErrorApi(receta.error).mensaje}</Alerta>}
        {receta.data && (
          // `key`: al guardar llega la versión nueva y el formulario arranca de ella.
          <FormularioReceta key={vigente?.version ?? 0} productoId={producto.id} vigente={vigente} onGuardada={onCerrar} />
        )}
        {receta.data && receta.data.versiones.length > 0 && <Historial versiones={receta.data.versiones} />}
      </div>
    </Dialogo>
  )
}

function FormularioReceta({ productoId, vigente, onGuardada }: { productoId: string; vigente: RecetaPt | null; onGuardada: () => void }) {
  const { tienePermiso } = useSesion()
  const guardar = useGuardarReceta(productoId)
  const inicial: ComponenteReceta[] = vigente?.componentes.map(({ itemId, cantidad }) => ({ itemId, cantidad })) ?? []
  const [componentes, setComponentes] = useState(inicial)
  const cambio = JSON.stringify(componentes) !== JSON.stringify(inicial)

  if (!tienePermiso('inventario.catalogo')) {
    return vigente ? <ListaComponentes receta={vigente} /> : <p className="text-sm text-tinta-suave">Este PT no tiene receta.</p>
  }

  return (
    <div className="space-y-3">
      {vigente ? (
        <p className="text-sm text-tinta-suave">
          Vigente: <strong className="text-tinta">versión {vigente.version}</strong> desde {fechaHora(vigente.vigenteDesde)} ({vigente.creadaPorNombre}).
          Guardar cambios crea la versión {vigente.version + 1}; la anterior se conserva.
        </p>
      ) : (
        <Alerta tipo="advertencia">Este PT no tiene receta. Agregue los PI e insumos que lleva.</Alerta>
      )}
      <EditorReceta componentes={componentes} onCambiar={setComponentes} />
      {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
      <div className="flex justify-end gap-2">
        <Boton
          onClick={() => guardar.mutate(componentes, { onSuccess: onGuardada })}
          cargando={guardar.isPending}
          disabled={!recetaValida(componentes) || !cambio}
        >
          {vigente ? `Guardar como versión ${vigente.version + 1}` : 'Guardar receta'}
        </Boton>
      </div>
    </div>
  )
}

function ListaComponentes({ receta }: { receta: RecetaPt }) {
  return (
    <ul className="space-y-1 text-sm">
      {receta.componentes.map((c) => (
        <li key={c.itemId}>
          <span className="text-tinta-suave">{c.tipo}</span> <span className="cifra">{c.codigo}</span> {c.descripcion} —{' '}
          <strong>{textoEquivalenciaReceta(c.cantidad, c.unidadMedida)}</strong>
          {!c.activo && <span className="ml-1 text-xs text-critico">(inactivo)</span>}
        </li>
      ))}
    </ul>
  )
}

function Historial({ versiones }: { versiones: RecetaPt[] }) {
  return (
    <details className="rounded-lg border border-borde px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-tinta">Historial ({versiones.length} {versiones.length === 1 ? 'versión' : 'versiones'})</summary>
      <ol className="mt-2 space-y-3">
        {versiones.map((v) => (
          <li key={v.id} className="text-sm">
            <p className="font-medium text-tinta">
              Versión {v.version} · {fechaHora(v.vigenteDesde)} · {v.creadaPorNombre}
            </p>
            <ListaComponentes receta={v} />
          </li>
        ))}
      </ol>
    </details>
  )
}
