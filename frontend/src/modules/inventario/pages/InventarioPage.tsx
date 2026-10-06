/**
 * INVENTARIO — EXISTENCIAS
 * ========================
 *
 * Cuánto hay de insumos, PI y PT (usuario, 2026-09-29). Filtro por tipo
 * y búsqueda en la URL. Desde cada ítem: registrar un movimiento o ver
 * su kardex.
 */

import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { EstadoVacio } from '../../../components/EstadoVacio'
import { IconoInventario } from '../../../components/Iconos'
import { FilaRegistro, ListaRegistros } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { SelectorSegmentado } from '../../../components/SelectorSegmentado'
import { comoErrorApi } from '../../../services/http'
import { TIPOS_ITEM, type ItemInventario, type TipoItem } from '../../../shared/types/inventario'
import { cantidad } from '../../../shared/utils/numeros'
import { useSesion } from '../../auth/useSesion'
import { MovimientoDialogo } from '../components/MovimientoDialogo'
import { useItemsInventario } from '../hooks/useInventario'
import { TONO_TIPO } from '../tonos'

const PESTANAS: Array<{ tipo: TipoItem | ''; nombre: string }> = [
  { tipo: '', nombre: 'Todo' },
  { tipo: 'INSUMO', nombre: 'Insumos' },
  { tipo: 'PI', nombre: 'PI' },
  { tipo: 'PT', nombre: 'PT' },
]

export function InventarioPage() {
  const [params, setParams] = useSearchParams()
  const tipoParam = params.get('tipo')
  const tipo = TIPOS_ITEM.includes(tipoParam as TipoItem) ? (tipoParam as TipoItem) : undefined
  const texto = params.get('texto') ?? ''
  const items = useItemsInventario({ tipo, texto, soloActivos: true })
  const { tienePermiso } = useSesion()
  const [moviendo, setMoviendo] = useState<ItemInventario | null>(null)

  const cambiar = (clave: string, valor: string) => {
    const siguiente = new URLSearchParams(params)
    if (valor) siguiente.set(clave, valor)
    else siguiente.delete(clave)
    setParams(siguiente, { replace: true })
  }

  const lista = items.data ?? []
  const enCero = lista.filter((i) => i.existencia === 0).length

  return (
    <section className="space-y-6">
      {/* Barra de herramientas: sin caja, el filtro y la acción a la vista. */}
      <div className="flex flex-wrap items-end gap-4">
        <SelectorSegmentado
          etiqueta="Tipo de ítem"
          opciones={PESTANAS.map((p) => ({ valor: p.tipo, texto: p.nombre }))}
          activo={tipo ?? ''}
          cambiar={(v) => cambiar('tipo', v)}
        />
        <div className="min-w-60 flex-1">
          <Campo etiqueta="Buscar" placeholder="Código o descripción" value={texto} onChange={(e) => cambiar('texto', e.target.value)} />
        </div>
        {tienePermiso('inventario.registrar') && (
          <Link to="/inventario/entradas/nueva">
            <Boton>+ Entrada de mercancía</Boton>
          </Link>
        )}
      </div>

      {items.isError && <Alerta tipo="error">{comoErrorApi(items.error).mensaje}</Alerta>}

      <Seccion
        titulo="Existencias"
        contador={items.data ? lista.length : undefined}
        descripcion="Cuánto hay de cada ítem. Cada movimiento queda en su kardex con quién, cuándo y por qué."
        accion={enCero > 0 && <Badge tono="alerta">{enCero} en cero</Badge>}
      >
        <ListaRegistros
          cargando={items.isLoading}
          estaVacia={lista.length === 0}
          claveAnimacion={`${tipo ?? ''}|${texto}`}
          vacio={
            <EstadoVacio
              Icono={IconoInventario}
              titulo={texto || tipo ? 'Ningún ítem coincide con el filtro' : 'Todavía no hay ítems'}
              texto={texto || tipo ? 'Cambie el tipo o la búsqueda.' : 'Los PT, PI e insumos se crean cada uno en su pestaña.'}
            />
          }
        >
          {lista.map((i) => (
            <FilaRegistro
              key={i.id}
              tono={i.existencia === 0 ? 'neutro' : TONO_TIPO[i.tipo]}
              etiqueta={<Badge tono={TONO_TIPO[i.tipo]}>{i.tipo}</Badge>}
              titulo={i.descripcion}
              detalle={<span className="cifra">{i.codigo}</span>}
              cifra={cantidad(i.existencia)}
              unidad={i.unidadMedida}
              colorCifra={i.existencia === 0 ? 'text-tinta-suave' : 'text-tinta'}
              notaCifra={i.existencia === 0 ? 'en cero' : undefined}
              acciones={
                <>
                  {tienePermiso('inventario.registrar') && (
                    <Boton variante="secundario" tamano="sm" onClick={() => setMoviendo(i)}>
                      Movimiento
                    </Boton>
                  )}
                  <Link to={`/inventario/${i.id}`}>
                    <Boton variante="sutil" tamano="sm">
                      Kardex →
                    </Boton>
                  </Link>
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>

      {moviendo && <MovimientoDialogo item={moviendo} onCerrar={() => setMoviendo(null)} />}
    </section>
  )
}
