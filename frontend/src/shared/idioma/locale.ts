/**
 * LOCALE ACTIVO PARA NÚMEROS Y FECHAS
 * ===================================
 *
 * `miles()`, `porcentaje()` y los formatos de fecha necesitan saber el
 * idioma, pero son funciones sueltas: no pueden usar un hook de React.
 *
 * Por eso el locale vive aquí, en un módulo, y el proveedor de idioma lo
 * actualiza cuando cambia. Es un valor global, que normalmente conviene
 * evitar; aquí se acepta porque es exactamente eso: una sola
 * configuración del documento entero, como el idioma del `<html>`.
 *
 * OJO con los formatos: en español "1.234" son mil doscientos treinta y
 * cuatro; en inglés eso mismo se escribe "1,234". El punto y la coma
 * cambian de papel. Por eso no se puede formatear a mano en ningún
 * sitio: siempre a través de estas funciones.
 */

let localeActual = 'es-CO'

export function fijarLocale(locale: string): void {
  localeActual = locale
}

export function localeDeFormato(): string {
  return localeActual
}
