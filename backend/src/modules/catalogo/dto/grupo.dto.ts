import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

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

  /** Personas que el grupo debería enviar por turno. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  personasEsperadas?: number | null;
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

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @IsPositive()
  personasEsperadas?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
