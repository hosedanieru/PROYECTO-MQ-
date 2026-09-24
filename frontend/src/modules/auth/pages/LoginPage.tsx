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
import { BotonIdioma } from '../../../components/BotonIdioma'
import { BotonTema } from '../../../components/BotonTema'
import { Boton } from '../../../components/Boton'
import { Campo } from '../../../components/Campo'
import { Logo } from '../../../components/Logo'
import { comoErrorApi } from '../../../services/http'
import { useAparecer } from '../../../shared/animacion/useAnimacion'
import { useTextos } from '../../../shared/idioma/useTextos'
import { useSesion } from '../useSesion'

/*
 * Los mensajes del esquema son claves del diccionario, no textos: zod se
 * define una vez fuera del componente y no puede pedir la traducción,
 * así que se traduce al mostrarlos.
 */
const esquema = z.object({
  documento: z.string().trim().min(1, 'login.faltaDocumento'),
  contrasena: z.string().min(1, 'login.faltaContrasena'),
  recordar: z.boolean(),
})

type Formulario = z.infer<typeof esquema>

export function LoginPage() {
  const { usuario, iniciarSesion } = useSesion()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const { t } = useTextos()
  const tarjeta = useAparecer<HTMLDivElement>()

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
    <main className="grid min-h-screen lg:grid-cols-2">
      {/*
        Panel de marca. Solo en pantalla grande: en el móvil de planta
        ocuparía toda la pantalla y dejaría el formulario abajo.
      */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-marina p-12 text-white lg:flex">
        <Logo variante="claro" />
        <div className="relative z-10 max-w-md">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/50">
            {t('login.marcaEtiqueta')}
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">
            {t('login.marcaTitulo')}
          </h2>
          <p className="mt-4 leading-relaxed text-white/70">{t('login.marcaTexto')}</p>
        </div>
        <p className="text-xs text-white/40">{t('login.sede')}</p>

        {/* Formas de fondo: puro adorno, fuera del flujo del contenido. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full border-[40px] border-white/5"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-marca/20 blur-3xl"
        />
      </section>

      <div ref={tarjeta} className="relative flex items-center justify-center p-6">
        {/* Idioma y tema también antes de entrar: quien no lee español
            debe poder cambiarlo sin tener sesión. */}
        <div className="absolute right-6 top-6 flex gap-2">
          <BotonIdioma />
          <BotonTema />
        </div>

        <form
          onSubmit={enviar}
          noValidate
          className="w-full max-w-sm space-y-5 rounded-tarjeta border border-borde bg-base p-8 shadow-tarjeta"
        >
          <header className="space-y-2">
            <span className="lg:hidden">
              <Logo variante="oscuro" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-tinta">{t('login.titulo')}</h1>
            <p className="text-sm text-tinta-suave">{t('login.subtitulo')}</p>
          </header>

          {errorServidor && <Alerta tipo="error">{errorServidor}</Alerta>}

          <Campo
            etiqueta={t('login.documento')}
            error={errors.documento?.message ? t('login.faltaDocumento') : undefined}
            inputMode="numeric"
            autoComplete="username"
            autoFocus
            {...register('documento')}
          />

          <Campo
            etiqueta={t('login.contrasena')}
            type="password"
            error={errors.contrasena?.message ? t('login.faltaContrasena') : undefined}
            autoComplete="current-password"
            {...register('contrasena')}
          />

          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-borde accent-[var(--color-marca)]"
              {...register('recordar')}
            />
            {t('login.recordar')}
          </label>
          <p className="-mt-3 text-xs text-tinta-suave">{t('login.avisoRecordar')}</p>

          <Boton type="submit" cargando={isSubmitting} className="w-full">
            {t('login.entrar')}
          </Boton>
        </form>
      </div>
    </main>
  )
}
