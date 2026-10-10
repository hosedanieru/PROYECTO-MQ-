import { http } from '../../../services/http'
import type { DatosEnvioRemisiones, DatosLista, EnvioCorreo, ListaDistribucion } from '../../../shared/types/correo'

export const correoApi = {
  listas: () => http.get<ListaDistribucion[]>('/correos/listas').then((r) => r.data),
  crearLista: (datos: DatosLista) => http.post<ListaDistribucion>('/correos/listas', datos).then((r) => r.data),
  actualizarLista: (id: string, cambios: Partial<DatosLista> & { activo?: boolean }) =>
    http.patch<ListaDistribucion>(`/correos/listas/${id}`, cambios).then((r) => r.data),
  enviarRemisiones: (datos: DatosEnvioRemisiones) => http.post<EnvioCorreo>('/correos/remisiones', datos).then((r) => r.data),
  envios: (desde: string, hasta: string) => http.get<EnvioCorreo[]>('/correos/envios', { params: { desde, hasta } }).then((r) => r.data),
  // Genera los PDF y espera al servidor de correo: más que el tiempo por defecto.
  reenviar: (id: string) => http.post<EnvioCorreo>(`/correos/envios/${id}/reenviar`, undefined, { timeout: 120_000 }).then((r) => r.data),
}
