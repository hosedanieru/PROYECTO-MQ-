/**
 * DTO: CREAR REMISIÓN
 * ===================
 *
 * Forma del cuerpo HTTP para `POST /api/remisiones`. Solo valida forma y
 * tipos; las reglas de negocio (cantidades coherentes, estibas repetidas,
 * fecha de vencimiento posterior, etc.) viven en la entidad `Remision`.
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearRemisionDto {
  @IsUUID()
  turnoId!: string;

  @IsUUID()
  proveedorId!: string;

  @IsUUID()
  lugarId!: string;

  @IsUUID()
  productoId!: string;

  @Type(() => Date)
  @IsDate({ message: 'fechaVencimiento debe ser una fecha válida (ISO 8601)' })
  fechaVencimiento!: Date;

  @IsInt()
  @IsPositive()
  cantidadCajas!: number;

  @IsInt()
  @IsPositive()
  cantidadUnidades!: number;

  @IsInt()
  @Min(0)
  estibasCompletas!: number;

  @IsInt()
  @Min(0)
  cajasSueltas!: number;

  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @IsPositive({ each: true })
  numerosEstiba!: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
