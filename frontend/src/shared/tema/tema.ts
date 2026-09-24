/**
 * TEMA CLARO / OSCURO — lógica sin React
 * ======================================
 *
 * El tema vive en el atributo `data-tema` del `<html>`; el CSS hace todo
 * lo demás (ver `index.css`). Aquí solo está leerlo, escribirlo y
 * recordarlo.
 *
 * Decisión (2026-09-23): se arranca SIEMPRE en claro, no se sigue la
 * preferencia de Windows. En planta, dos personas del mismo turno deben
 * ver lo mismo al entrar; que la aplicación cambie de aspecto según el
 * computador confunde más de lo que ayuda. Quien prefiera el oscuro lo
 * elige y se recuerda en ese equipo.
 */

export type Tema = 'claro' | 'oscuro'

export const TEMA_POR_DEFECTO: Tema = 'claro'

const CLAVE = 'mq.tema'

/** Lo guardado en este equipo, o `null` si nunca se eligió. */
export function temaGuardado(): Tema | null {
  try {
    const valor = window.localStorage.getItem(CLAVE)
    return valor === 'claro' || valor === 'oscuro' ? valor : null
  } catch {
    // Modo privado o almacenamiento bloqueado: no es un error, solo no
    // hay preferencia guardada.
    return null
  }
}

export function guardarTema(tema: Tema): void {
  try {
    window.localStorage.setItem(CLAVE, tema)
  } catch {
    // Que no se pueda recordar no impide usar la aplicación.
  }
}

/** Lo aplica al documento. Es lo único que el CSS observa. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
}
