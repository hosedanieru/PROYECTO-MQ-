/**
 * IDIOMA DE LA INTERFAZ — lógica sin React
 * ========================================
 *
 * Español por defecto, inglés como alternativa. Se recuerda por equipo,
 * igual que el tema.
 *
 * QUÉ SE TRADUCE Y QUÉ NO (decisión del 2026-09-24)
 * -------------------------------------------------
 * Se traduce la INTERFAZ: rótulos, botones, títulos, ayudas y mensajes.
 *
 * NO se traducen los DATOS del negocio: descripciones de producto
 * ("SURTIDO MEGA LONCHERA X 24"), nombres de grupo (LOGICMARD), líneas
 * (REEMPAQUES) ni turnos. Son datos de PepsiCo y del área; el nombre
 * del SKU es lo que permite cotejar contra el DPP, y traducirlo sería
 * romper ese puente. En inglés la pantalla queda con los rótulos en
 * inglés y los datos en español: es intencional.
 */

export type Idioma = 'es' | 'en'

export const IDIOMA_POR_DEFECTO: Idioma = 'es'

const CLAVE = 'mq.idioma'

/**
 * Formato de números y fechas de cada idioma.
 *
 * En inglés se usa `en-GB` y no `en-US` a propósito: las dos escriben
 * los meses en inglés, pero `en-GB` deja la fecha en día/mes/año, que es
 * como la lee la planta. Con `en-US`, "03/04" pasaría a significar 4 de
 * marzo y eso sí se presta a un error real.
 */
export const LOCALE: Record<Idioma, string> = {
  es: 'es-CO',
  en: 'en-GB',
}

export function idiomaGuardado(): Idioma | null {
  try {
    const valor = window.localStorage.getItem(CLAVE)
    return valor === 'es' || valor === 'en' ? valor : null
  } catch {
    // Modo privado o almacenamiento bloqueado: no hay preferencia.
    return null
  }
}

export function guardarIdioma(idioma: Idioma): void {
  try {
    window.localStorage.setItem(CLAVE, idioma)
  } catch {
    // Que no se pueda recordar no impide usar la aplicación.
  }
}

/**
 * Lo aplica al documento: `<html lang>` es lo que leen el corrector
 * ortográfico, los lectores de pantalla y el traductor del navegador.
 */
export function aplicarIdioma(idioma: Idioma): void {
  document.documentElement.lang = idioma
}
