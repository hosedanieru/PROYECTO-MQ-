/**
 * DTO: EDITAR REMISIÓN
 * ====================
 *
 * Todos los campos opcionales: se envía solo lo que cambia. La regla de
 * "cuándo se puede editar" y la coherencia del documento completo las
 * decide la entidad, no este DTO.
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { EsId } from '../../../infrastructure/http/validadores.js';

export class EditarRemisionDto {
  @IsOptional()
  @EsId()
  turnoId?: string;

  @IsOptional()
  @EsId()
  grupoId?: string;

  @IsOptional()
  @EsId()
  lugarId?: string;

  @IsOptional()
  @EsId()
  productoId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'fechaVencimiento debe ser una fecha válida (ISO 8601)' })
  fechaVencimiento?: Date;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cantidadCajas?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cantidadUnidades?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estibasCompletas?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cajasSueltas?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  numerosEstiba?: number[];

  /** `null` explícito borra las observaciones. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  observaciones?: string | null;

  @IsOptional()
  @IsBoolean()
  extraoficial?: boolean;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  motivoExtraoficial?: string | null;
}
