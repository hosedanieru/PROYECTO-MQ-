/**
 * HASH DE CONTRASEÑAS — Implementación con bcrypt
 * ===============================================
 *
 * Implementa el puerto `HashContrasena` del dominio.
 *
 * bcrypt incorpora la "sal" dentro del propio hash, así que no hay que
 * guardarla aparte, y su costo es configurable: cada incremento de
 * `RONDAS` duplica el tiempo de cálculo. 10 rondas ≈ 60–100 ms en un
 * equipo corriente: imperceptible en un login, prohibitivo para quien
 * intente probar millones de contraseñas.
 */

import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

import type { HashContrasena } from '../../domain/usuario/contrasena.js';

const RONDAS = 10;

@Injectable()
export class BcryptHashService implements HashContrasena {
  hashear(contrasena: string): Promise<string> {
    return bcrypt.hash(contrasena, RONDAS);
  }

  verificar(contrasena: string, hash: string): Promise<boolean> {
    return bcrypt.compare(contrasena, hash);
  }
}
