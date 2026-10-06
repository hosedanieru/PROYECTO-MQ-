import { createHash } from 'node:crypto';

import type { CalculadorHuella } from '../../domain/remision/firma-remision.js';

/** SHA-256 en hexadecimal: la huella del contenido que respalda una firma. */
export class CalculadorHuellaSha256 implements CalculadorHuella {
  sha256(texto: string): string {
    return createHash('sha256').update(texto, 'utf8').digest('hex');
  }
}
