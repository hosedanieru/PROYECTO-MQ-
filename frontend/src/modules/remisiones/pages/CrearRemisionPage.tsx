/**
 * CREAR REMISIÓN
 * ==============
 *
 * Muestra la fecha operativa a la que quedará el registro (corte 06:00),
 * para que a las 02:00 nadie se sorprenda de que "es ayer". El valor real
 * lo calcula el servidor; aquí es informativo y sirve para validar el
 * vencimiento antes de enviar.
 */

import { useNavigate } from 'react-router-dom'

import { fechaCorta, fechaOperativaDe } from '../../../shared/utils/fechas'
import { RemisionForm } from '../components/RemisionForm'
import { useCrearRemision } from '../hooks/useRemisiones'

export function CrearRemisionPage() {
  const navegar = useNavigate()
  const crear = useCrearRemision()
  const fechaOperativa = fechaOperativaDe(new Date())

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nueva remisión</h1>
        <p className="text-sm text-slate-600">
          Quedará registrada en el día operativo <strong>{fechaCorta(fechaOperativa)}</strong>{' '}
          (corte 06:00 a 06:00).
        </p>
      </header>

      <RemisionForm
        fechaOperativa={fechaOperativa}
        textoEnviar="Crear remisión"
        enviando={crear.isPending}
        error={crear.error}
        onEnviar={async (datos) => {
          const creada = await crear.mutateAsync(datos)
          navegar(`/remisiones/${creada.id}`)
        }}
        onCancelar={() => navegar('/remisiones')}
      />
    </section>
  )
}
