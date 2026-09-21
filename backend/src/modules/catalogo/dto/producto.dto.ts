import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  PROCESOS_PRODUCTO,
  type ProcesoProducto,
} from '../../../domain/producto/producto.repository.js';

/**
 * `ValidateIf` permite enviar `null` explícito para "borrar" un valor
 * opcional; `IsOptional` solo aceptaría `undefined`.
 */
export class CrearProductoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descripcion!: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(PROCESOS_PRODUCTO)
  proceso?: ProcesoProducto | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  unidadesPorCaja?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  cajasPorEstiba?: number | null;

  /** LINEA IDEAL: personas necesarias en la línea para este SKU. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  personasIdeal?: number | null;

  /** SUBDESCRIPCION: familia del producto (SURTIDO, OFERTA, REEMPAQUE, MULTIPACK…). */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  subdescripcion?: string | null;

  /** Estándares de producción: se pueden dar al crear; después se editan con motivo (PUT /mfr/estandares). */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  cajasPorHora?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  pesoNetoKg?: number | null;
}

export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descripcion?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsIn(PROCESOS_PRODUCTO)
  proceso?: ProcesoProducto | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  unidadesPorCaja?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  cajasPorEstiba?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(0)
  personasIdeal?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(40)
  subdescripcion?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
