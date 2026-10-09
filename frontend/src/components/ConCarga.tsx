import { addTransitionType, startTransition, useEffect, useState, ViewTransition, type ReactNode } from 'react'

import { useReducedMotion } from '../shared/animacion/movimiento'
import { useDemora } from '../shared/useDemora'
import { FormaEsqueleto, type FormaCarga } from './PantallaCargando'

interface Props {
  cargando: boolean
  forma: FormaCarga
  mensaje?: string
  /** Clases del contenedor (por ejemplo `space-y-6`, la separación que tenía la sección). */
  className?: string
  /** El contenido; se evalúa aunque esté cargando, así que se protege con `datos && …`. */
  children: ReactNode
}

/** Marca de la transición que trae el contenido: solo ella dispara el barrido. */
const TIPO_CARGA = 'carga'

/**
 * CON CARGA — esqueleto y, al llegar el dato, el barrido
 * ======================================================
 *
 * La pieza completa del ejemplo de Motion `react-skeleton-shimmer`
 * (usuario, 2026-10-08): pasado el primer segundo aparece el esqueleto (con
 * el brillo de Motion, `Esqueleto.tsx`) y, cuando llegan los datos, una
 * cortina con borde suave lo retira hacia la izquierda y el contenido
 * aparece desde la derecha, como en el ejemplo. La cortina es una
 * transición de vista de React (`<ViewTransition>`); su CSS está en
 * `index.css` (clase `barrido`).
 *
 * Por qué `<ViewTransition>` directo y no `AnimateView` de Motion (que lo
 * envuelve): `AnimateView` deja activas las animaciones por defecto, así
 * que CUALQUIER cambio dentro de una transición de React (la carga de la
 * ruta, cambiar de pestaña) animaba el área y, mientras duraba, el
 * navegador bloqueaba los clics (comprobado el 2026-10-08). Aquí todo está
 * apagado (`default="none"`) salvo el "update" de las transiciones marcadas
 * con `addTransitionType('carga')`, que solo hace este componente.
 *
 * Detalles:
 * - React solo anima un cambio hecho dentro de `startTransition`; los datos
 *   de TanStack Query no llegan así, por eso el componente pasa SU estado
 *   (`listo`) a verdadero en una transición marcada.
 * - Sin esqueleto (cargó en menos de un segundo) o con "reducir movimiento",
 *   el contenido aparece directo, sin barrido.
 * - El nombre de la transición es único en la página: UNA `ConCarga` por
 *   pantalla (el área principal). Dos con el mismo nombre se anulan.
 */
export function ConCarga({ cargando, forma, mensaje = 'Cargando…', className = '', children }: Props) {
  const esqueleto = useDemora(cargando)
  const quieto = useReducedMotion()
  const [listo, setListo] = useState(!cargando)
  // ¿Se llegó a ver el esqueleto? Solo entonces hay algo que barrer.
  const [huboEsqueleto, setHuboEsqueleto] = useState(false)
  const [cargandoAntes, setCargandoAntes] = useState(cargando)

  /*
   * Ajustes de estado DURANTE el render, comparando con el valor anterior
   * (lo que recomienda React en vez de un efecto: no hay render de más).
   * - Empieza una carga (al cambiar de día, por ejemplo): todo de cero,
   *   así el barrido sale cada vez.
   * - Termina sin que se haya visto el esqueleto (o con "reducir
   *   movimiento"): el contenido entra directo, sin barrido.
   * Ojo, comprobado el 2026-10-08: el reinicio solo debe ocurrir cuando
   * CAMBIA `cargando`; si se repitiera al aparecer el esqueleto, lo borraba
   * y el barrido nunca salía.
   */
  if (cargando !== cargandoAntes) {
    setCargandoAntes(cargando)
    if (cargando) {
      setListo(false)
      setHuboEsqueleto(false)
    } else if (!huboEsqueleto || quieto) {
      setListo(true)
    }
  }
  if (esqueleto && !huboEsqueleto) setHuboEsqueleto(true)

  // Termina con el esqueleto a la vista: el contenido entra con el barrido. Va en un
  // efecto porque React solo anima un cambio hecho dentro de `startTransition`.
  useEffect(() => {
    if (cargando || !huboEsqueleto || quieto || listo) return
    startTransition(() => {
      addTransitionType(TIPO_CARGA)
      setListo(true)
    })
  }, [cargando, huboEsqueleto, quieto, listo])

  const verContenido = !cargando && listo

  return (
    <ViewTransition name="contenido-carga" default="none" update={{ [TIPO_CARGA]: 'barrido', default: 'none' }}>
      {/* Un solo elemento raíz: pasar del esqueleto al contenido es un "update" de esta vista. */}
      <div aria-busy={!verContenido} className={className}>
        {verContenido ? (
          children
        ) : (
          <div role="status">
            <span className="sr-only">{mensaje}</span>
            {(esqueleto || huboEsqueleto) && <FormaEsqueleto forma={forma} />}
          </div>
        )}
      </div>
    </ViewTransition>
  )
}
