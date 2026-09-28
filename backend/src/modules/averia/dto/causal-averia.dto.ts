import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

const PATRON_CODIGO = /^[A-Za-z0-9_-]{1,40}$/;
const MENSAJE_CODIGO = 'codigo: 1 a 40 letras, números, guion o guion bajo';

export class CrearCausalDto {
  @IsString()
  @Matches(PATRON_CODIGO, { message: MENSAJE_CODIGO })
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre!: string;

  /** Posición en la lista desplegable. */
  @IsInt()
  @Min(0)
  orden!: number;
}

export class ActualizarCausalDto {
  @IsOptional()
  @IsString()
  @Matches(PATRON_CODIGO, { message: MENSAJE_CODIGO })
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
