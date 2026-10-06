import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  NotEquals,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { DECIMALES_CANTIDAD } from '../../../domain/inventario/cantidad.js';
import { MAXIMO_LINEAS_CIERRE } from '../../../domain/inventario/cierre-inventario.js';
import { MAXIMO_LINEAS_ENTRADA } from '../../../domain/inventario/entrada-mercancia.js';
import { TIPOS_ITEM, type TipoItem } from '../../../domain/inventario/item-inventario.js';
import { MAXIMO_COMPONENTES_RECETA } from '../../../domain/inventario/receta.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Unidades de medida ----------

export class CrearUnidadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre!: string;
}

export class ActualizarUnidadDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ---------- PI e insumos ----------

/** `null` = no se maneja esa presentación (caja o estiba). */
export class CrearMaterialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  codigo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  descripcion!: string;

  /** La medida en que se lleva y se descuenta (METRO, UNIDAD…). */
  @IsString()
  @MinLength(1)
  unidadBaseId!: string;

  /** Cómo viene empacado (ROLLO…); va con `contenidoPresentacion`. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  presentacionId?: string | null;

  /** Cuánto de la medida trae la presentación (50 metros por rollo). */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @IsPositive()
  contenidoPresentacion?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  unidadesPorCaja?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  cajasPorEstiba?: number | null;
}

export class ActualizarMaterialDto {
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  unidadBaseId?: string;

  /** `null` quita la presentación; omitirlo la deja como está. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MinLength(1)
  presentacionId?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @IsPositive()
  contenidoPresentacion?: number | null;

  /** `null` quita el escalón; omitirlo lo deja como está. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  unidadesPorCaja?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  cajasPorEstiba?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ---------- Existencias ----------

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

// ---------- Conteo mixto (fase B) ----------

/**
 * Lo que se digita como viene: "2 estibas + 5 cajas + 3 rollos + 12,5 metros".
 * Se envían los cuatro (0 en lo que no se usa); el dominio convierte a la
 * medida del ítem con sus equivalencias.
 */
export class ConteoDto {
  @IsInt()
  @Min(0)
  estibas!: number;

  @IsInt()
  @Min(0)
  cajas!: number;

  /** Rollos, bolsas… según la presentación del ítem. */
  @IsInt()
  @Min(0)
  presentaciones!: number;

  /** Medida suelta (metros, unidades), con decimales. */
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @Min(0)
  medida!: number;
}

/** `cantidad` es obligatoria salvo que llegue `conteo`. */
const sinConteo = (o: { conteo?: unknown }) => o.conteo === undefined || o.conteo === null;

// ---------- Movimientos ----------

/** Entrada o salida, en la medida del ítem (hasta 3 decimales; el PT en cajas enteras, lo exige el dominio). */
export class RegistrarMovimientoDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsIn(['ENTRADA', 'SALIDA'])
  tipo!: 'ENTRADA' | 'SALIDA';

  @ValidateIf(sinConteo)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @IsPositive()
  cantidad?: number;

  /** En lugar de `cantidad`: como viene (rollos, cajas…). Solo PI e insumos. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ConteoDto)
  conteo?: ConteoDto;

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
  @ValidateIf(sinConteo)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @NotEquals(0)
  cantidad?: number;

  /** En lugar de `cantidad`: lo que se CONTÓ físicamente; el ajuste es la diferencia con la existencia. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ConteoDto)
  conteo?: ConteoDto;

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

  @ValidateIf(sinConteo)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @IsPositive()
  cantidad?: number;

  /** En lugar de `cantidad`: como llega (10 rollos, 2 cajas…). */
  @IsOptional()
  @ValidateNested()
  @Type(() => ConteoDto)
  conteo?: ConteoDto;
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

// ---------- Receta del PT ----------

/** Cuánto gasta UNA caja de PT del PI o insumo, en su medida (1,8 metros; 12 unidades). */
export class ComponenteRecetaDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @IsPositive()
  cantidad!: number;
}

export class GuardarRecetaDto {
  @ValidateNested({ each: true })
  @Type(() => ComponenteRecetaDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_COMPONENTES_RECETA)
  componentes!: ComponenteRecetaDto[];
}

// ---------- Cierre del día (conteo físico y merma) ----------

/** Lo contado de un material: cantidad en su medida (puede ser 0) o conteo como viene. */
export class LineaCierreDto {
  @IsString()
  @MinLength(1)
  itemId!: string;

  @ValidateIf(sinConteo)
  @IsNumber({ maxDecimalPlaces: DECIMALES_CANTIDAD })
  @Min(0)
  cantidad?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConteoDto)
  conteo?: ConteoDto;
}

export class RegistrarCierreDto {
  @Matches(FECHA, { message: 'fechaOperativa: formato YYYY-MM-DD' })
  fechaOperativa!: string;

  @ValidateNested({ each: true })
  @Type(() => LineaCierreDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMO_LINEAS_CIERRE)
  lineas!: LineaCierreDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}

/** Día operativo de las alertas. */
export class FechaAlertasDto {
  @Matches(FECHA, { message: 'fecha: formato YYYY-MM-DD' })
  fecha!: string;
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
