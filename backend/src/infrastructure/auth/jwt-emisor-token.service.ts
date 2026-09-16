/**
 * EMISOR DE TOKEN — Implementación con JWT
 * ========================================
 *
 * Implementa el puerto `EmisorDeToken` usando `@nestjs/jwt`.
 *
 * Un JWT son tres partes separadas por punto: cabecera, contenido y
 * firma. El contenido NO va cifrado, solo codificado en base64: cualquiera
 * puede leerlo. Lo que impide falsificarlo es la firma, calculada con
 * `JWT_SECRET`. Por eso el secreto nunca va en el código ni en Git.
 *
 * Nombres de campo: JWT usa `sub` (subject) para identificar al dueño
 * del token. Aquí se traduce a/desde el `ContenidoToken` del dominio.
 */

import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type {
  ContenidoToken,
  EmisorDeToken,
} from '../../domain/usuario/emisor-token.js';

interface CargaJwt {
  sub: string;
  documento: string;
}

@Injectable()
export class JwtEmisorTokenService implements EmisorDeToken {
  constructor(private readonly jwt: JwtService) {}

  emitir(contenido: ContenidoToken): Promise<string> {
    const carga: CargaJwt = {
      sub: contenido.usuarioId,
      documento: contenido.documento,
    };
    return this.jwt.signAsync(carga);
  }

  async verificar(token: string): Promise<ContenidoToken | null> {
    try {
      const carga = await this.jwt.verifyAsync<CargaJwt>(token);
      if (typeof carga.sub !== 'string' || typeof carga.documento !== 'string') {
        return null;
      }
      return { usuarioId: carga.sub, documento: carga.documento };
    } catch {
      // Firma inválida, token expirado o malformado: para el dominio son
      // lo mismo — no hay identidad confiable.
      return null;
    }
  }
}
