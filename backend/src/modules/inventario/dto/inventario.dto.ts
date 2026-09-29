import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { MAXIMO_LINEAS_ENTRADA } from '../../../domain/inventario/entrada-mercancia.js';
import { TIPOS_ITEM, type TipoItem } from '../../../domain/inventario/item-inventario.js';
import { DECIMALES_CANTIDAD } from '../../../domain/inventario/movimiento-inventario.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class CrearItemDto {
  @IsIn(TIPOS_ITEM)
  tipo!: TipoItem;

  /** INSUMO / PI. En PT se omite: sale del producto. */
  @ValidateIf((o: CrearItemDto) => o.tipo !== 'PT')
  @IsString()
  @MaxLength(40)
  codigo?: string;

  @ValidateIf((o: CrearItemDto) => o.tipo !== 'PT')
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unidadMedida!: string;

  /** Solo PT. */
  @ValidateIf((o: CrearItemDto) => o.tipo === 'PT')
  @IsString()
  @MinLength(1)
  productoId?: string;
}

export class ActualizarItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  unidadMedida?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class FiltroItemsDto {
  @IsOptional()
  @IsIn(TIPOS_ITEM)
  tipo?: TipoItem;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  texto?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  soloActivos?: boolean;
}

/** Entrada o salida (coordinador, patinador). */
export class RegistrarMovimientoDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsIn(['ENTRADA', 'SALIDA'])
  tipo!: 'ENTRADA' | 'SALIDA';

  /** Positiva; hasta 3 decimales (la regla completa está en el dominio). */
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  cantidad!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

/** Ajuste (administrador): cantidad con signo y motivo obligatorio. */
export class RegistrarAjusteDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  /** + suma, − resta. */
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  cantidad!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

export class LineaEntradaDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  cantidad!: number;
}

/** Entrada de mercancía: un documento con varias líneas (reglas completas en el dominio). */
export class RegistrarEntradaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  documento!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  remitente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @ValidateNested({ each: true })
  @Type(() => LineaEntradaDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_LINEAS_ENTRADA)
  lineas!: LineaEntradaDto[];
}

export class RangoFechasDto {
  @Matches(FECHA, { message: 'desde: formato YYYY-MM-DD' })
  desde!: string;

  @Matches(FECHA, { message: 'hasta: formato YYYY-MM-DD' })
  hasta!: string;
}

export class KardexDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(500)
  limite?: number;
}

export class FiltroMovimientosDto {
  @Matches(FECHA, { message: 'desde: formato YYYY-MM-DD' })
  desde!: string;

  @Matches(FECHA, { message: 'hasta: formato YYYY-MM-DD' })
  hasta!: string;

  @IsOptional()
  @IsIn(['ENTRADA', 'SALIDA', 'AJUSTE'])
  tipo?: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
}
