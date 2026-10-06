/**
 * Agrupa una lista ya ordenada por una clave (normalmente el día
 * operativo), conservando el orden en que llegan los grupos y los
 * elementos. Para la línea de tiempo del kardex y de las entradas.
 */
export function agruparEnOrden<T>(lista: T[], clave: (x: T) => string): Array<{ clave: string; elementos: T[] }> {
  const grupos: Array<{ clave: string; elementos: T[] }> = []
  for (const x of lista) {
    const k = clave(x)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.clave === k) ultimo.elementos.push(x)
    else grupos.push({ clave: k, elementos: [x] })
  }
  return grupos
}
