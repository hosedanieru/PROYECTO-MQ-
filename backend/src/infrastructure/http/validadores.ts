/**
 * VALIDADORES COMPARTIDOS DE DTOs
 * ===============================
 *
 * `@EsId()` valida un identificador de registro sin asumir su formato:
 * PostgreSQL genera UUID, Firestore genera cadenas de 20 caracteres y los
 * catálogos sembrados en Firestore usan su código (`T1`, `ADMINISTRADOR`).
 * El DTO solo exige que sea un texto corto y seguro; si el id no existe,
 * lo dice el caso de uso (404 o 400 de dominio).
 */

import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';

export const PATRON_ID = /^[A-Za-z0-9_-]+$/;

export function EsId(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MaxLength(64),
    Matches(PATRON_ID, { message: '$property debe ser un identificador válido' }),
  );
}
