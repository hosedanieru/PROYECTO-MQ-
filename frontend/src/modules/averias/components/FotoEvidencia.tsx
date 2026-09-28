/**
 * Foto guardada de un reporte. Se pide con el token (como Blob) porque un
 * `<img src="/api/...">` no lo enviaría. Al tocarla se abre en grande.
 */

import { useQuery } from '@tanstack/react-query'

import type { TipoEvidencia } from '../../../shared/types/averia'
import { NOMBRE_EVIDENCIA } from '../../../shared/types/averia'
import { averiasApi } from '../api/averias.api'
import { useUrlDeArchivo } from '../hooks/useUrlDeArchivo'

interface Props {
  reporteId: string
  registroId: string
  tipo: TipoEvidencia
}

export function FotoEvidencia({ reporteId, registroId, tipo }: Props) {
  const foto = useQuery({
    queryKey: ['averias', 'foto', reporteId, registroId, tipo],
    queryFn: () => averiasApi.foto(reporteId, registroId, tipo),
    // La foto no cambia nunca: una vez descargada, no se vuelve a pedir.
    staleTime: Infinity,
  })
  const url = useUrlDeArchivo(foto.data)

  return (
    <figure className="space-y-1">
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg border border-borde bg-velo">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" title="Ver en grande">
            <img src={url} alt={NOMBRE_EVIDENCIA[tipo]} className="h-32 w-full object-cover" />
          </a>
        ) : (
          <span className="text-xs text-tinta-suave">{foto.isError ? 'No disponible' : 'Cargando…'}</span>
        )}
      </div>
      <figcaption className="text-xs text-tinta-suave">{NOMBRE_EVIDENCIA[tipo]}</figcaption>
    </figure>
  )
}
