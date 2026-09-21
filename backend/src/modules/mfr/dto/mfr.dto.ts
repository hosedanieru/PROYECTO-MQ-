/**
 * DTOs DEL MÓDULO MFR
 * ===================
 *
 * Forma de los cuerpos HTTP. Las reglas (solapamiento, motivo
 * obligatorio al corregir, turno cerrado, rango de eficiencia…) viven
 * en el dominio.
 */

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { TIPOS_LINEA } from '../../../domain/mfr/linea-produccion.js';
import { EsId } from '../../../infrastructure/http/validadores.js';

const FECHA_OPERATIVA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Bloques ----------

export class DatosBloqueDto {
  @EsId()
  lineaId!: string;

  @EsId()
  productoId!: string;

  @Matches(HORA, { message: 'horaInicio debe ser HH:mm' })
  horaInicio!: string;

  @Matches(HORA, { message: 'horaFin debe ser HH:mm' })
  horaFin!: string;

  @IsNumber()
  @IsPositive()
  cajasPorHora!: number;

  @IsNumber()
  @Min(1)
  @Max(100)
  eficienciaPorcentaje!: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(40)
  loop?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  personasAsignadas?: number | null;
}

export class GuardarBloqueDto extends DatosBloqueDto {
  @Matches(FECHA_OPERATIVA, { message: 'fechaOperativa debe ser YYYY-MM-DD' })
  fechaOperativa!: string;

  /** Si viene, se corrige ese bloque y el motivo es obligatorio. */
  @IsOptional()
  @EsId()
  id?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo?: string;
}

export class MotivoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}

export class CargarDiaDto {
  @Matches(FECHA_OPERATIVA, { message: 'fechaOperativa debe ser YYYY-MM-DD' })
  fechaOperativa!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DatosBloqueDto)
  bloques!: DatosBloqueDto[];

  @IsIn(['MANUAL', 'DPP'])
  origen!: 'MANUAL' | 'DPP';

  @IsBoolean()
  reemplazar!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo?: string;
}

export class CopiarDiaDto {
  @Matches(FECHA_OPERATIVA, { message: 'desde debe ser YYYY-MM-DD' })
  desde!: string;

  @Matches(FECHA_OPERATIVA, { message: 'hacia debe ser YYYY-MM-DD' })
  hacia!: string;

  @IsBoolean()
  reemplazar!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo?: string;
}

export class CerrarTurnoDto {
  @Matches(FECHA_OPERATIVA, { message: 'fechaOperativa debe ser YYYY-MM-DD' })
  fechaOperativa!: string;

  @EsId()
  turnoId!: string;

  /** Obligatorio si algún SKU del turno quedó por debajo de su target. */
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivoFaltante?: string;
}

// ---------- Asistencia (personal del turno) ----------

export class RegistrarAsistenciaDto {
  @Matches(FECHA_OPERATIVA, { message: 'fechaOperativa debe ser YYYY-MM-DD' })
  fechaOperativa!: string;

  @EsId()
  turnoId!: string;

  @EsId()
  grupoId!: string;

  @IsInt()
  @Min(0)
  personasLlegaron!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}

// ---------- Asignación de grupos a líneas ----------

export class AsignarGrupoLineaDto {
  @Matches(FECHA_OPERATIVA, { message: 'fechaOperativa debe ser YYYY-MM-DD' })
  fechaOperativa!: string;

  @EsId()
  turnoId!: string;

  @EsId()
  lineaId!: string;

  @EsId()
  grupoId!: string;

  @IsInt()
  @Min(1)
  personas!: number;
}

// ---------- Líneas ----------

export class CrearLineaDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'codigo: 1 a 20 caracteres alfanuméricos o guion' })
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  @IsIn(TIPOS_LINEA)
  tipo!: (typeof TIPOS_LINEA)[number];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  capacidadKgHora?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class ActualizarLineaDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'codigo: 1 a 20 caracteres alfanuméricos o guion' })
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsIn(TIPOS_LINEA)
  tipo?: (typeof TIPOS_LINEA)[number];

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsPositive()
  capacidadKgHora?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ---------- Estándares ----------

export class ActualizarEstandarDto {
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  cajasPorHora?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  @IsPositive()
  pesoNetoKg?: number | null;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  motivo!: string;
}
