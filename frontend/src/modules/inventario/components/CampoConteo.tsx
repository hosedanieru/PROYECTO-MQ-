/**
 * CONTEO COMO VIENE
 * =================
 *
 * Campos para digitar lo que llega o se cuenta tal como viene empacado
 * —estibas, cajas, rollos y metros sueltos— según lo que el ítem tenga
 * definido, con el total en su medida a la vista ("= 500 METRO").
 * Controlado: los textos viven en quien lo usa.
 */

import { Campo } from '../../../components/Campo'
import type { ItemInventario } from '../../../shared/types/inventario'
import { cantidad as fmt } from '../../../shared/utils/numeros'
import { escalonesDe, leerConteo, totalDeConteo, type Campos } from '../conteo'

interface Props {
  item: Pick<ItemInventario, 'unidadMedida' | 'equivalencias'>
  campos: Campos
  onCambiar: (campos: Campos) => void
  /** Conteo físico (ajuste): contar 0 es un dato válido. */
  permitirCero?: boolean
}

export function CampoConteo({ item, campos, onCambiar, permitirCero = false }: Props) {
  const escalones = escalonesDe(item)
  const hayAlgo = Object.values(campos).some((v) => v.trim() !== '')
  const total = totalDeConteo(leerConteo(campos), item, permitirCero)
  const eq = item.equivalencias

  return (
    <div className="space-y-1">
      <div className={`grid gap-2 ${escalones.length > 2 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        {escalones.map((e) => (
          <Campo
            key={e.campo}
            etiqueta={e.etiqueta}
            type="number"
            inputMode={e.enteros ? 'numeric' : 'decimal'}
            min={0}
            step={e.enteros ? 1 : 'any'}
            value={campos[e.campo]}
            onChange={(ev) => onCambiar({ ...campos, [e.campo]: ev.target.value })}
          />
        ))}
      </div>
      <p className={`text-xs ${hayAlgo && total === null ? 'text-critico' : 'text-tinta-suave'}`}>
        {hayAlgo && total === null
          ? 'Revise el conteo: estibas, cajas y presentaciones van en enteros; lo suelto, hasta 3 decimales.'
          : hayAlgo
            ? <>= <span className="cifra font-semibold text-tinta">{fmt(total!)} {item.unidadMedida}</span></>
            : eq?.presentacion && eq.contenidoPresentacion
              ? `1 ${eq.presentacion} = ${fmt(eq.contenidoPresentacion)} ${item.unidadMedida}${eq.unidadesPorCaja ? ` · 1 caja = ${eq.unidadesPorCaja} ${eq.presentacion}` : ''}`
              : `Se cuenta en ${item.unidadMedida}.`}
      </p>
    </div>
  )
}
