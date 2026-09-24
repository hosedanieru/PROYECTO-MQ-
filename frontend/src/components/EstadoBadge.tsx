import { useTextos } from '../shared/idioma/useTextos'
import type { EstadoRemision } from '../shared/types/remision'
import { Badge } from './Badge'
import { TONO_ESTADO } from './tonos-estado'

export function EstadoBadge({ estado }: { estado: EstadoRemision }) {
  const { t } = useTextos()
  return (
    <Badge tono={TONO_ESTADO[estado]} punto>
      {t(`estado.${estado}`)}
    </Badge>
  )
}
