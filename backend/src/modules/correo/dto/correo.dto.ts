import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { MAXIMO_CORREOS_LISTA, MAXIMO_DESTINATARIOS, RECIBE_LISTA, type RecibeLista } from '../../../domain/correo/correo.js';
import { MAXIMO_REMISIONES_POR_CORREO } from '../../../application/correo/correo.use-cases.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** La forma; que cada correo sea válido y no se repita lo decide el dominio. */
export class CrearListaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre!: string;

  /** Qué recibe al cerrar el turno. Por defecto, las remisiones (como en la fase 1). */
  @IsOptional()
  @IsIn(RECIBE_LISTA)
  recibe?: RecibeLista;

  /** Lista de un turno (va cuando ese turno es el siguiente); null = lista general. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  turnoId?: string | null;

  @IsOptional()
  @IsBoolean()
  incluirEnCierres?: boolean;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAXIMO_CORREOS_LISTA)
  correos!: string[];
}

export class ActualizarListaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsIn(RECIBE_LISTA)
  recibe?: RecibeLista;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  turnoId?: string | null;

  @IsOptional()
  @IsBoolean()
  incluirEnCierres?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAXIMO_CORREOS_LISTA)
  correos?: string[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class EnviarRemisionesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAXIMO_REMISIONES_POR_CORREO)
  remisionIds!: string[];

  @IsArray()
  @IsString({ each: true })
  listaIds!: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAXIMO_DESTINATARIOS)
  correos!: string[];
}

export class RangoEnviosDto {
  @Matches(FECHA, { message: 'desde: formato YYYY-MM-DD' })
  desde!: string;

  @Matches(FECHA, { message: 'hasta: formato YYYY-MM-DD' })
  hasta!: string;
}
