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

import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { MAXIMO_TAMANO_TRAZO, TIPOS_FIRMA, type TipoFirma } from '../../../domain/remision/firma-remision.js';

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

/**
 * Firma electrónica de una casilla. Quién firma sale del token; la
 * contraseña se pide de nuevo (equipo compartido) y no se guarda.
 */
export class FirmarRemisionDto {
  @IsIn(TIPOS_FIRMA)
  tipo!: TipoFirma;

  /** PNG del trazo como data URL (el dominio valida forma y tamaño). */
  @IsString()
  @MaxLength(MAXIMO_TAMANO_TRAZO)
  trazo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contrasena!: string;
}

/** El OPA aprueba desde su cuenta y firma "quien recibe" (fase 2). Su nombre sale del token. */
export class AprobarFirmandoDto {
  @IsString()
  @MaxLength(MAXIMO_TAMANO_TRAZO)
  trazo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contrasena!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  opaCargo?: string;
}

export class ValidarRemisionDto {
  /** Contacto de PepsiCo con quien se concilió (cuaderno virtual). */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  concilidadoCon!: string;
}

/** El coordinador valida firmando la casilla VALIDACION (fase 3). */
export class ValidarFirmandoDto extends ValidarRemisionDto {
  @IsString()
  @MaxLength(MAXIMO_TAMANO_TRAZO)
  trazo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contrasena!: string;
}
