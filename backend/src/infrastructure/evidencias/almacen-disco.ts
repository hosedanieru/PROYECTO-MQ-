/**
 * ALMACÉN DE EVIDENCIAS — Disco local
 * ===================================
 *
 * Guarda las fotos en una carpeta del servidor:
 *
 *   EVIDENCIAS_DIR/2026/09/<uuid>.jpg     (por defecto ./evidencias)
 *
 * Decisión del usuario (2026-09-28): lo simple por ahora; el almacén de
 * producción se decide después. En Docker, EVIDENCIAS_DIR debe apuntar a
 * un volumen para que las fotos sobrevivan a un redespliegue, y hay que
 * incluirlo en las copias de respaldo.
 *
 * La ruta se valida contra un patrón estricto antes de tocar el disco:
 * nadie puede pedir "../../.env" a través del endpoint de fotos.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { AlmacenDeEvidencias, ArchivoEvidencia } from '../../domain/averia/almacen-evidencias.js';

const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const PATRON_RUTA = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class AlmacenEvidenciasDisco implements AlmacenDeEvidencias {
  private readonly raiz = path.resolve(process.env.EVIDENCIAS_DIR ?? 'evidencias');

  async guardar(archivo: ArchivoEvidencia): Promise<string> {
    const extension = EXTENSION[archivo.tipoMime];
    if (!extension) throw new Error(`Tipo de imagen no admitido: ${archivo.tipoMime}`);
    const ahora = new Date();
    const carpeta = `${ahora.getUTCFullYear()}/${String(ahora.getUTCMonth() + 1).padStart(2, '0')}`;
    const ruta = `${carpeta}/${randomUUID()}.${extension}`;
    await mkdir(path.join(this.raiz, carpeta), { recursive: true });
    await writeFile(path.join(this.raiz, ruta), archivo.contenido, { flag: 'wx' });
    return ruta;
  }

  async leer(ruta: string): Promise<ArchivoEvidencia | null> {
    if (!PATRON_RUTA.test(ruta)) return null;
    try {
      const contenido = await readFile(path.join(this.raiz, ruta));
      return { contenido, tipoMime: MIME[ruta.split('.').pop()!] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async eliminar(ruta: string): Promise<void> {
    if (!PATRON_RUTA.test(ruta)) return;
    await rm(path.join(this.raiz, ruta), { force: true });
  }
}
