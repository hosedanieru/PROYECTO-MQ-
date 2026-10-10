/**
 * DOBLES DE PRUEBA — Correo
 * =========================
 *
 * Solo se importan desde archivos `*.spec.ts` (y desde la unidad de trabajo falsa).
 */

import type {
  DatosLista,
  EnviadorDeCorreo,
  EnvioCorreo,
  EnvioCorreoRepository,
  ListaDistribucion,
  ListaDistribucionRepository,
  MensajeCorreo,
  NuevoEnvio,
} from '../../domain/correo/correo.js';

export class ListaDistribucionRepositorioFalso implements ListaDistribucionRepository {
  readonly listas: ListaDistribucion[] = [];

  agregar(lista: ListaDistribucion): void {
    this.listas.push(lista);
  }

  listar(): Promise<ListaDistribucion[]> {
    return Promise.resolve([...this.listas]);
  }

  buscarPorId(id: string): Promise<ListaDistribucion | null> {
    return Promise.resolve(this.listas.find((l) => l.id === id) ?? null);
  }

  crear(datos: DatosLista): Promise<ListaDistribucion> {
    const lista = { ...datos, id: `lista-${this.listas.length + 1}`, activo: true };
    this.listas.push(lista);
    return Promise.resolve(lista);
  }

  actualizar(id: string, cambios: Partial<DatosLista> & { activo?: boolean }): Promise<ListaDistribucion> {
    const i = this.listas.findIndex((l) => l.id === id);
    this.listas[i] = { ...this.listas[i], ...cambios };
    return Promise.resolve(this.listas[i]);
  }
}

export class EnvioCorreoRepositorioFalso implements EnvioCorreoRepository {
  readonly envios: EnvioCorreo[] = [];

  crear(envio: NuevoEnvio): Promise<EnvioCorreo> {
    const creado = { ...envio, id: `envio-${this.envios.length + 1}` };
    this.envios.push(creado);
    return Promise.resolve(creado);
  }

  buscarPorId(id: string): Promise<EnvioCorreo | null> {
    return Promise.resolve(this.envios.find((e) => e.id === id) ?? null);
  }

  listar(desde: Date, hasta: Date): Promise<EnvioCorreo[]> {
    return Promise.resolve(this.envios.filter((e) => e.fechaOperativa >= desde && e.fechaOperativa <= hasta));
  }
}

/** Guarda los mensajes en vez de enviarlos; `fallarCon` simula que el servidor los rechaza. */
export class EnviadorDeCorreoFalso implements EnviadorDeCorreo {
  readonly enviados: MensajeCorreo[] = [];
  fallarCon: string | null = null;

  enviar(mensaje: MensajeCorreo): Promise<void> {
    if (this.fallarCon) return Promise.reject(new Error(this.fallarCon));
    this.enviados.push(mensaje);
    return Promise.resolve();
  }
}
