/**
 * Dónde vive el token en el navegador.
 *
 * "Recordar sesión" (marcado en el login):
 *   - sí → `localStorage`: sobrevive a cerrar el navegador. Para el
 *     equipo propio de un coordinador durante su turno de hasta 10 h.
 *   - no → `sessionStorage`: se borra al cerrar la pestaña. Para
 *     equipos compartidos en planta.
 *
 * Mismo criterio que el aplicativo de recepción de Inlotrans, para que
 * el área encuentre el comportamiento que ya conoce.
 */

const CLAVE = 'mq.token'

export const almacenToken = {
  leer(): string | null {
    return sessionStorage.getItem(CLAVE) ?? localStorage.getItem(CLAVE)
  },
  guardar(token: string, recordar: boolean): void {
    if (recordar) {
      localStorage.setItem(CLAVE, token)
      sessionStorage.removeItem(CLAVE)
    } else {
      sessionStorage.setItem(CLAVE, token)
      localStorage.removeItem(CLAVE)
    }
  },
  borrar(): void {
    sessionStorage.removeItem(CLAVE)
    localStorage.removeItem(CLAVE)
  },
}
