/**
 * CORREO — Firestore
 * ==================
 *
 *   listasDistribucion/{id}   listas de destinatarios
 *   enviosCorreo/{id}         registro de cada envío (con fechaOperativaTexto para listar por día)
 */

import type { DocumentSnapshot } from 'firebase-admin/firestore';

import type {
  DatosLista,
  EnvioCorreo,
  EnvioCorreoRepository,
  ListaDistribucion,
  ListaDistribucionRepository,
  NuevoEnvio,
} from '../../../domain/correo/correo.js';
import { aDate, claveFecha, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

const listaADominio = (s: DocumentSnapshot): ListaDistribucion => {
  const d = s.data()!;
  return { id: s.id, nombre: d.nombre, recibe: d.recibe ?? 'REMISIONES', turnoId: d.turnoId ?? null, incluirEnCierres: d.incluirEnCierres ?? false, correos: d.correos ?? [], activo: d.activo ?? true };
};

export class ListaDistribucionFirestoreRepository implements ListaDistribucionRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.listasDistribucion);
  }

  async listar(): Promise<ListaDistribucion[]> {
    const q = await this.cliente.consultar(this.coleccion());
    return q.docs.map(listaADominio).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async buscarPorId(id: string): Promise<ListaDistribucion | null> {
    const s = await this.cliente.obtener(this.coleccion().doc(id));
    return s.exists ? listaADominio(s) : null;
  }

  async crear(datos: DatosLista): Promise<ListaDistribucion> {
    const id = this.cliente.nuevoId(COLECCION.listasDistribucion);
    await this.cliente.guardar(this.coleccion().doc(id), { ...datos, activo: true });
    return { id, ...datos, activo: true };
  }

  async actualizar(id: string, cambios: Partial<DatosLista> & { activo?: boolean }): Promise<ListaDistribucion> {
    const ref = this.coleccion().doc(id);
    const actual = await this.cliente.obtener(ref);
    await this.cliente.actualizar(ref, cambios);
    return { ...listaADominio(actual), ...cambios };
  }
}

const envioADominio = (s: DocumentSnapshot): EnvioCorreo => {
  const d = s.data()!;
  return {
    id: s.id,
    origen: d.origen,
    fechaHora: aDate(d.fechaHora),
    fechaOperativa: aDate(d.fechaOperativa),
    turnoId: d.turnoId ?? null,
    destinatarios: d.destinatarios ?? [],
    remisionIds: d.remisionIds ?? [],
    resumenIds: d.resumenIds ?? [],
    asunto: d.asunto,
    texto: d.texto ?? null,
    estado: d.estado,
    error: d.error ?? null,
    usuarioId: d.usuarioId,
    usuarioNombre: d.usuarioNombre,
  };
};

export class EnvioCorreoFirestoreRepository implements EnvioCorreoRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  private coleccion() {
    return this.cliente.coleccion(COLECCION.enviosCorreo);
  }

  async crear(envio: NuevoEnvio): Promise<EnvioCorreo> {
    const id = this.cliente.nuevoId(COLECCION.enviosCorreo);
    await this.cliente.guardar(this.coleccion().doc(id), { ...envio, fechaOperativaTexto: claveFecha(envio.fechaOperativa) });
    return { id, ...envio };
  }

  async buscarPorId(id: string): Promise<EnvioCorreo | null> {
    const s = await this.cliente.obtener(this.coleccion().doc(id));
    return s.exists ? envioADominio(s) : null;
  }

  async listar(desde: Date, hasta: Date): Promise<EnvioCorreo[]> {
    const q = await this.cliente.consultar(
      this.coleccion().where('fechaOperativaTexto', '>=', claveFecha(desde)).where('fechaOperativaTexto', '<=', claveFecha(hasta)),
    );
    return q.docs.map(envioADominio).sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());
  }
}
