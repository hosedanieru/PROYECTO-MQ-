import { useEffect, useState } from 'react'

/**
 * Cuánto espera la pantalla antes de mostrar el esqueleto de carga
 * (usuario, 2026-10-08: "cuando la página demore en cargar, pasado el
 * segundo"). Si los datos llegan antes, no se muestra nada: un esqueleto
 * que aparece y desaparece en 200 ms se ve como un parpadeo.
 */
export const DEMORA_ESQUELETO_MS = 1000

/**
 * `true` solo cuando `activo` lleva al menos `ms` milisegundos siendo
 * verdadero. Vuelve a `false` en cuanto `activo` se apaga.
 */
export function useDemora(activo: boolean, ms = DEMORA_ESQUELETO_MS): boolean {
  const [vencido, setVencido] = useState(false)
  useEffect(() => {
    if (!activo) return
    const reloj = setTimeout(() => setVencido(true), ms)
    return () => {
      clearTimeout(reloj)
      setVencido(false)
    }
  }, [activo, ms])
  return activo && vencido
}
