import { useEffect, useMemo } from 'react'

/**
 * URL temporal (`blob:`) para mostrar un archivo en un `<img>`. Se libera
 * sola cuando el archivo cambia o el componente desaparece; sin eso, cada
 * foto vista quedaría ocupando memoria hasta cerrar la pestaña.
 */
export function useUrlDeArchivo(archivo: Blob | null | undefined): string | null {
  const url = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}
