/**
 * DTOs DEL FLUJO DE LA REMISIÓN
 * =============================
 *
 * Validan la forma de los datos de cada transición de estado.
 *
 *   BORRADOR ──► ENTREGADA ──► APROBADA ──► VALIDADA
 *                    ▲              │
 *                    │              ▼
 *                    └── EN_RECTIFICACION ◄── RECHAZADA
 *
 * Quién ejecuta cada acción NO viene en el cuerpo: sale del token
 * (`@UsuarioActual()` en el controlador). Por eso `entregar` y
 * `rectificar` no tienen DTO: no reciben ningún dato del cliente.
 */

import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AprobarRemisionDto {
  /** Nombre del OPA de PepsiCo que aprueba. No es usuario del sistema. */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  opaNombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  opaCargo?: string;
}

export class RechazarRemisionDto {
  /**
   * Motivo del rechazo. Obligatorio: saber que una remisión fue
   * rechazada sin saber por qué no sirve para rectificarla.
   */
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}

export class ValidarRemisionDto {
  /** Contacto de PepsiCo con quien se concilió (cuaderno virtual). */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  concilidadoCon!: string;
}
