/**
 * PANTALLA DE LOGIN
 * =================
 *
 * Formulario con react-hook-form + zod. Zod valida la FORMA (campos
 * vacíos); si las credenciales están mal, eso lo dice el backend y se
 * muestra tal cual: el mensaje no distingue documento de contraseña a
 * propósito (ver `CredencialesInvalidasError` en el backend).
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { comoErrorApi } from '../../../services/http'
import { useSesion } from '../useSesion'

const esquema = z.object({
  documento: z.string().trim().min(1, 'Ingrese su documento.'),
  contrasena: z.string().min(1, 'Ingrese su contraseña.'),
  recordar: z.boolean(),
})

type Formulario = z.infer<typeof esquema>

export function LoginPage() {
  const { usuario, iniciarSesion } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    defaultValues: { documento: '', contrasena: '', recordar: false },
  })

  // Ya logueado: no tiene sentido mostrar el login.
  if (usuario) {
    return <Navigate to="/" replace />
  }

  const destino = (ubicacion.state as { desde?: string } | null)?.desde ?? '/'

  const enviar = handleSubmit(async (datos) => {
    setErrorServidor(null)
    try {
      await iniciarSesion(datos.documento, datos.contrasena, datos.recordar)
      navegar(destino, { replace: true })
    } catch (error) {
      setErrorServidor(comoErrorApi(error).mensaje)
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={enviar}
        noValidate
        className="w-full max-w-sm space-y-5 rounded-xl bg-white p-8 shadow-md"
      >
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Maquila MQ</h1>
          <p className="text-sm text-slate-500">Inlotrans S.A.S.</p>
        </header>

        {errorServidor && <Alerta tipo="error">{errorServidor}</Alerta>}

        <Campo
          etiqueta="Documento"
          error={errors.documento?.message}
          inputMode="numeric"
          autoComplete="username"
          autoFocus
          {...register('documento')}
        />

        <Campo
          etiqueta="Contraseña"
          type="password"
          error={errors.contrasena?.message}
          autoComplete="current-password"
          {...register('contrasena')}
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('recordar')} />
          Recordar sesión en este equipo
        </label>
        <p className="-mt-3 text-xs text-slate-500">
          No lo marques en un computador compartido: la sesión se cerrará al cerrar la pestaña.
        </p>

        <Boton type="submit" cargando={isSubmitting} className="w-full">
          Ingresar
        </Boton>
      </form>
    </main>
  )
}
