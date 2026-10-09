/** 6,25 — cajas por persona-hora con dos decimales, con coma (es-CO). */
export const cajasPorPersonaHora = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 83,3 — porcentaje con un decimal, sin el signo (lo pone quien muestra). */
export const unDecimal = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
