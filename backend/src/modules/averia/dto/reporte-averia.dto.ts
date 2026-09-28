import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { LARGO_MAXIMO_LOTE, UNIDADES_MEDIDA_AVERIA } from '../../../domain/averia/registro-averia.js';
import { MAXIMO_REGISTROS_POR_REPORTE } from '../../../domain/averia/reporte-averia.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Una fila del formulario. Las fotos llegan aparte, como archivos `foto_{fila}_{TIPO}`. */
export class RegistroAveriaDto {
  @IsString()
  @MinLength(1)
  productoId!: string;

  @Matches(FECHA, { message: 'fechaVencimiento: formato YYYY-MM-DD' })
  fechaVencimiento!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(LARGO_MAXIMO_LOTE)
  lote!: string;

  @IsString()
  @MinLength(1)
  causalId!: string;

  @IsInt()
  @Min(1)
  cantidad!: number;

  @IsIn(UNIDADES_MEDIDA_AVERIA)
  unidadMedida!: (typeof UNIDADES_MEDIDA_AVERIA)[number];
}

/** Campo `datos` (JSON) del multipart. */
export class CrearReporteAveriaDto {
  @IsString()
  @MinLength(1)
  grupoId!: string;

  @ValidateNested({ each: true })
  @Type(() => RegistroAveriaDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_REGISTROS_POR_REPORTE)
  registros!: RegistroAveriaDto[];
}

/** Corrección del administrador: solo lo que se envía cambia. */
export class CorregirRegistroAveriaDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  productoId?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'fechaVencimiento: formato YYYY-MM-DD' })
  fechaVencimiento?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(LARGO_MAXIMO_LOTE)
  lote?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  causalId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsIn(UNIDADES_MEDIDA_AVERIA)
  unidadMedida?: (typeof UNIDADES_MEDIDA_AVERIA)[number];
}

export class AnularReporteAveriaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;
}

export class FiltroReportesAveriaDto {
  @Matches(FECHA, { message: 'desde: formato YYYY-MM-DD' })
  desde!: string;

  @Matches(FECHA, { message: 'hasta: formato YYYY-MM-DD' })
  hasta!: string;

  @IsOptional()
  @IsString()
  turnoId?: string;

  @IsOptional()
  @IsString()
  grupoId?: string;

  @IsOptional()
  @IsIn(['REGISTRADO', 'ANULADO'])
  estado?: 'REGISTRADO' | 'ANULADO';
}
