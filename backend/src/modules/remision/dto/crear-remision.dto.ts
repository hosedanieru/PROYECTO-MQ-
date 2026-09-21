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
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { EsId } from '../../../infrastructure/http/validadores.js';

export class CrearRemisionDto {
  @EsId()
  turnoId!: string;

  @EsId()
  grupoId!: string;

  @EsId()
  lugarId!: string;

  @EsId()
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

  /** Pedido de emergencia fuera del DPP: no cuenta para el MFR; exige motivo. */
  @IsOptional()
  @IsBoolean()
  extraoficial?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoExtraoficial?: string;
}
