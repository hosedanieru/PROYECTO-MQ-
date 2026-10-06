/**
 * CORREO — Implementación con Prisma
 * ==================================
 *
 *   lista_distribucion   listas de destinatarios (correos en un arreglo de texto)
 *   envio_correo         registro de cada envío de remisiones
 */

import type {
  DatosLista,
  EnvioCorreo,
  EnvioCorreoRepository,
  EstadoEnvio,
  ListaDistribucion,
  ListaDistribucionRepository,
  NuevoEnvio,
  OrigenEnvio,
  RecibeLista,
} from '../../../domain/correo/correo.js';
import type { ClientePrisma } from './cliente-prisma.js';

const SELECCION_LISTA = { id: true, nombre: true, recibe: true, turnoId: true, incluirEnCierres: true, correos: true, activo: true } as const;

export class ListaDistribucionPrismaRepository implements ListaDistribucionRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(): Promise<ListaDistribucion[]> {
    return (await this.cliente.listaDistribucion.findMany({ select: SELECCION_LISTA, orderBy: { nombre: 'asc' } })).map(listaADominio);
  }

  async buscarPorId(id: string): Promise<ListaDistribucion | null> {
    const fila = await this.cliente.listaDistribucion.findUnique({ where: { id }, select: SELECCION_LISTA });
    return fila ? listaADominio(fila) : null;
  }

  async crear(datos: DatosLista): Promise<ListaDistribucion> {
    return listaADominio(await this.cliente.listaDistribucion.create({ data: datos, select: SELECCION_LISTA }));
  }

  async actualizar(id: string, cambios: Partial<DatosLista> & { activo?: boolean }): Promise<ListaDistribucion> {
    return listaADominio(await this.cliente.listaDistribucion.update({ where: { id }, data: cambios, select: SELECCION_LISTA }));
  }
}

export class EnvioCorreoPrismaRepository implements EnvioCorreoRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async crear(envio: NuevoEnvio): Promise<EnvioCorreo> {
    return aDominio(await this.cliente.envioCorreo.create({ data: envio }));
  }

  async listar(desde: Date, hasta: Date): Promise<EnvioCorreo[]> {
    const filas = await this.cliente.envioCorreo.findMany({
      where: { fechaOperativa: { gte: desde, lte: hasta } },
      orderBy: { fechaHora: 'desc' },
    });
    return filas.map(aDominio);
  }
}

/** recibe se guarda como texto; el dominio lo acota. */
function listaADominio(f: Omit<ListaDistribucion, 'recibe'> & { recibe: string }): ListaDistribucion {
  return { ...f, recibe: f.recibe as RecibeLista };
}

/** origen y estado se guardan como texto; el dominio los acota. */
function aDominio(f: Omit<EnvioCorreo, 'origen' | 'estado'> & { origen: string; estado: string }): EnvioCorreo {
  return { ...f, origen: f.origen as OrigenEnvio, estado: f.estado as EstadoEnvio };
}
