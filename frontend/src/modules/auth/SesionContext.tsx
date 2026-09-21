/**
 * PROVEEDOR DE SESIÓN
 * ===================
 *
 * Una sola fuente de verdad sobre "quién está logueado". Cualquier
 * componente la consulta con `useSesion()` (archivo aparte).
 *
 * Ciclo de vida:
 *   1. Al cargar la app, si hay token guardado, pide `/auth/perfil`
 *      para reconstruir la sesión (estado `cargando` mientras tanto).
 *   2. `iniciarSesion` guarda el token y el perfil.
 *   3. `cerrarSesion` borra ambos.
 *   4. Si cualquier petición devuelve 401, `http.ts` avisa y se cierra.
 *
 * Los permisos vienen del perfil, que el backend lee de la base en cada
 * petición; el frontend solo los usa para OCULTAR acciones. La
 * verdadera autorización siempre ocurre en el servidor.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { almacenToken } from '../../services/almacen-token'
import { registrarManejoSesionExpirada } from '../../services/http'
import type { PerfilUsuario } from '../../shared/types/api'
import { authApi } from './api/auth.api'
import { SesionContext, type Sesion } from './sesion-context'

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<PerfilUsuario | null>(null)
  const [cargando, setCargando] = useState(() => almacenToken.leer() !== null)

  const cerrarSesion = useCallback(() => {
    almacenToken.borrar()
    setUsuario(null)
  }, [])

  // Reconstruir la sesión al arrancar si hay token guardado.
  useEffect(() => {
    if (!almacenToken.leer()) {
      return
    }
    authApi
      .perfil()
      .then(setUsuario)
      .catch(cerrarSesion)
      .finally(() => setCargando(false))
  }, [cerrarSesion])

  // Que el cliente HTTP pueda cerrar la sesión cuando reciba un 401.
  useEffect(() => {
    registrarManejoSesionExpirada(cerrarSesion)
  }, [cerrarSesion])

  const iniciarSesion = useCallback(
    async (documento: string, contrasena: string, recordar: boolean) => {
      const sesion = await authApi.login(documento, contrasena)
      almacenToken.guardar(sesion.token, recordar)
      setUsuario(sesion.usuario)
    },
    [],
  )

  const valor = useMemo<Sesion>(
    () => ({
      usuario,
      cargando,
      iniciarSesion,
      cerrarSesion,
      // El administrador ve y puede todo (misma regla que el backend).
      tienePermiso: (codigo) =>
        usuario?.rolCodigo === 'ADMINISTRADOR' || (usuario?.permisos.includes(codigo) ?? false),
    }),
    [usuario, cargando, iniciarSesion, cerrarSesion],
  )

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
