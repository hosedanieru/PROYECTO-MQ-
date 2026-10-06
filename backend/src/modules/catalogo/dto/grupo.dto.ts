import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { MAXIMO_PERSONAS_GRUPO } from '../../../domain/grupo/grupo.repository.js';

/** Personas que el grupo debería enviar a un turno. */
export class EsperadasTurnoDto {
  @IsString()
  @MinLength(1)
  turnoId!: string;

  @IsInt()
  @Max(MAXIMO_PERSONAS_GRUPO)
  personas!: number;
}

/** `ValidateIf` admite `null` explícito para borrar un valor opcional. */
export class CrearGrupoDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'codigo: 1 a 30 letras, números, guion o guion bajo' })
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre!: string;

  /** Texto libre: aquí se escribe el proveedor real. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  /** Una entrada por turno donde se espera al grupo; el que no viene, no va. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EsperadasTurnoDto)
  esperadasPorTurno?: EsperadasTurnoDto[];
}

export class ActualizarGrupoDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,30}$/, { message: 'codigo: 1 a 30 letras, números, guion o guion bajo' })
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  nombre?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  /** Si viene, reemplaza todas las esperadas por turno del grupo. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EsperadasTurnoDto)
  esperadasPorTurno?: EsperadasTurnoDto[];

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** De la lista del DTO al mapa del dominio. */
export const aMapaEsperadas = (lista: EsperadasTurnoDto[]) => Object.fromEntries(lista.map((e) => [e.turnoId, e.personas]));
