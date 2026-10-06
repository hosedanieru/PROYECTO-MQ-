/**
 * ENVIADOR DE CORREO — nodemailer
 * ===============================
 *
 * Con `CORREO_HOST` en el .env envía por SMTP con el buzón corporativo
 * (usuario, 2026-10-03). Valores típicos:
 *
 *   Microsoft 365     CORREO_HOST=smtp.office365.com  CORREO_PUERTO=587
 *   Google Workspace  CORREO_HOST=smtp.gmail.com      CORREO_PUERTO=587
 *
 *   CORREO_USUARIO, CORREO_CLAVE   la cuenta (TI debe habilitar "SMTP AUTH"
 *                                  en Microsoft 365, o una contraseña de
 *                                  aplicación en Google)
 *   CORREO_REMITENTE               "MQ Inlotrans <mq@inlotrans.com.co>"
 *                                  (por defecto, CORREO_USUARIO)
 *
 * SIN `CORREO_HOST` (desarrollo, o mientras TI entrega la cuenta) no envía
 * nada: guarda cada mensaje como archivo .eml en `CORREO_SALIDA_DIR` (por
 * defecto `correos-salida/`, fuera de git). Se abre con Outlook y se ve
 * exactamente lo que llegaría, con el PDF adjunto.
 *
 * Las credenciales viven solo en el .env, nunca en el código.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import nodemailer, { type Transporter } from 'nodemailer';

import type { EnviadorDeCorreo, MensajeCorreo } from '../../domain/correo/correo.js';

export interface ConfigCorreo {
  host: string | null;
  puerto: number;
  usuario: string | null;
  clave: string | null;
  remitente: string;
  carpetaSalida: string;
}

export function configCorreoDesdeEntorno(entorno: NodeJS.ProcessEnv = process.env): ConfigCorreo {
  const host = entorno.CORREO_HOST?.trim() || null;
  const usuario = entorno.CORREO_USUARIO?.trim() || null;
  return {
    host,
    puerto: Number(entorno.CORREO_PUERTO ?? 587),
    usuario,
    clave: entorno.CORREO_CLAVE ?? null,
    remitente: entorno.CORREO_REMITENTE?.trim() || usuario || 'MQ Inlotrans <no-responder@localhost>',
    carpetaSalida: path.resolve(entorno.CORREO_SALIDA_DIR?.trim() || 'correos-salida'),
  };
}

export class EnviadorNodemailer implements EnviadorDeCorreo {
  private readonly transporte: Transporter;
  /** Sin servidor configurado: se guarda el .eml en vez de enviarlo. */
  readonly enArchivo: boolean;

  constructor(private readonly config: ConfigCorreo) {
    this.enArchivo = config.host === null;
    this.transporte = this.enArchivo
      ? nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' })
      : nodemailer.createTransport({
          host: config.host!,
          port: config.puerto,
          secure: config.puerto === 465, // 587 usa STARTTLS
          auth: config.usuario ? { user: config.usuario, pass: config.clave ?? '' } : undefined,
        });
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    const info = await this.transporte.sendMail({
      from: this.config.remitente,
      to: mensaje.para.join(', '),
      subject: mensaje.asunto,
      text: mensaje.texto,
      attachments: mensaje.adjuntos.map((a) => ({ filename: a.nombre, content: a.contenido, contentType: a.tipo })),
    });
    if (this.enArchivo) {
      await mkdir(this.config.carpetaSalida, { recursive: true });
      const nombre = `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`;
      await writeFile(path.join(this.config.carpetaSalida, nombre), info.message as Buffer);
    }
  }
}
