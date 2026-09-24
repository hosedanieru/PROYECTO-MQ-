/**
 * CADA CUÁNTO SE REFRESCAN LOS DATOS
 * ==================================
 *
 * Un solo lugar para decidirlo, porque la cuenta no es obvia: en
 * Firestore cada listado de remisiones LEE TODOS los documentos del día
 * y filtra en memoria (no hay índice por estado). Bajar un intervalo no
 * cuesta "una petición más": cuesta una lectura completa del día, y
 * Firestore factura por documento leído.
 *
 * Por eso cada consulta usa el ritmo que le corresponde en vez de un
 * valor global: el tablero mira lo que cambia en el turno, y lo que no
 * cambia (ayer, el catálogo) casi no se vuelve a pedir.
 */

/** Por defecto para cualquier pantalla. */
export const REFRESCO_NORMAL = 30_000

/**
 * Tablero de inicio: el coordinador lo deja abierto y decide con lo que
 * ve. 10 s es lo más rápido que esta base de datos sostiene sin que el
 * costo se dispare (decisión del 2026-09-23).
 */
export const REFRESCO_TABLERO = 10_000

/**
 * Datos que ya no cambian o cambian muy rara vez: el total de ayer, el
 * catálogo de productos. Pedirlos cada 10 s sería gastar por nada.
 */
export const REFRESCO_LENTO = 5 * 60_000
