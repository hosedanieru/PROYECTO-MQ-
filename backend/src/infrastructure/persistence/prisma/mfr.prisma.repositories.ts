/**
 * MFR — Repositorios con Prisma
 * =============================
 *
 * Cuatro repositorios pequeños en un archivo: bloques de programación,
 * líneas, horarios y estándares. Todos reciben `ClientePrisma` para
 * poder usarse dentro de la unidad de trabajo.
 *
 * `cajasPorHora`, `eficienciaPorcentaje`, `capacidadKgHora` y `pesoNetoKg` son
 * `Decimal` en la base y `number` en el dominio; se convierten aquí.
 */

import { Injectable } from '@nestjs/common';

import {
  BloqueProgramacion,
  type BloqueRepository,
  type EstadoPersistidoBloque,
} from '../../../domain/mfr/bloque-programacion.js';
import type {
  DatosEstandar,
  EstandarProducto,
  EstandarRepository,
} from '../../../domain/mfr/estandar-produccion.js';
import type { HorarioRepository, HorarioTurno } from '../../../domain/mfr/horas-turno.js';
import type {
  DatosLinea,
  LineaProduccion,
  LineaRepository,
} from '../../../domain/mfr/linea-produccion.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClientePrisma } from './cliente-prisma.js';

const numeroONulo = (v: { toNumber(): number } | null): number | null => (v === null ? null : v.toNumber());

// ------------------------------------------------------------
// Líneas de producción
// ------------------------------------------------------------

type RegistroLinea = Prisma.LineaProduccionGetPayload<Record<string, never>>;

function lineaADominio(r: RegistroLinea): LineaProduccion {
  return {
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    tipo: r.tipo,
    capacidadKgHora: numeroONulo(r.capacidadKgHora),
    orden: r.orden,
    activo: r.activo,
  };
}

@Injectable()
export class LineaPrismaRepository implements LineaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(): Promise<LineaProduccion[]> {
    const filas = await this.cliente.lineaProduccion.findMany({ orderBy: [{ orden: 'asc' }, { codigo: 'asc' }] });
    return filas.map(lineaADominio);
  }

  async buscarPorId(id: string): Promise<LineaProduccion | null> {
    const fila = await this.cliente.lineaProduccion.findUnique({ where: { id } });
    return fila ? lineaADominio(fila) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<LineaProduccion | null> {
    const fila = await this.cliente.lineaProduccion.findUnique({ where: { codigo } });
    return fila ? lineaADominio(fila) : null;
  }

  async crear(datos: DatosLinea): Promise<LineaProduccion> {
    return lineaADominio(await this.cliente.lineaProduccion.create({ data: datos }));
  }

  async actualizar(id: string, cambios: Partial<DatosLinea> & { activo?: boolean }): Promise<LineaProduccion> {
    return lineaADominio(await this.cliente.lineaProduccion.update({ where: { id }, data: cambios }));
  }
}

// ------------------------------------------------------------
// Bloques de programación
// ------------------------------------------------------------

type RegistroBloque = Prisma.BloqueProgramacionGetPayload<Record<string, never>>;

function bloqueADominio(r: RegistroBloque): BloqueProgramacion {
  const estado: EstadoPersistidoBloque = {
    id: r.id,
    fechaOperativa: r.fechaOperativa,
    lineaId: r.lineaId,
    turnoId: r.turnoId,
    productoId: r.productoId,
    horaInicio: r.horaInicio,
    horaFin: r.horaFin,
    cajasPorHora: r.cajasPorHora.toNumber(),
    eficienciaPorcentaje: r.eficienciaPorcentaje.toNumber(),
    loop: r.loop,
    personasAsignadas: r.personasAsignadas,
    origen: r.origen,
    creadoPorId: r.creadoPorId,
    fechaCreacion: r.fechaCreacion,
    cerradoEn: r.cerradoEn,
    cerradoPorId: r.cerradoPorId,
  };
  return BloqueProgramacion.desdePersistencia(estado);
}

@Injectable()
export class BloquePrismaRepository implements BloqueRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listarPorFecha(fechaOperativa: Date): Promise<BloqueProgramacion[]> {
    const filas = await this.cliente.bloqueProgramacion.findMany({
      where: { fechaOperativa },
      orderBy: [{ linea: { orden: 'asc' } }, { horaInicio: 'asc' }],
    });
    return filas.map(bloqueADominio);
  }

  async buscarPorId(id: string): Promise<BloqueProgramacion | null> {
    const fila = await this.cliente.bloqueProgramacion.findUnique({ where: { id } });
    return fila ? bloqueADominio(fila) : null;
  }

  async crear(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    const d = bloque.aObjeto();
    const fila = await this.cliente.bloqueProgramacion.create({
      data: {
        fechaOperativa: d.fechaOperativa,
        lineaId: d.lineaId,
        turnoId: d.turnoId,
        productoId: d.productoId,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        cajasPorHora: d.cajasPorHora,
        eficienciaPorcentaje: d.eficienciaPorcentaje,
        loop: d.loop,
        personasAsignadas: d.personasAsignadas,
        origen: d.origen,
        creadoPorId: d.creadoPorId,
        fechaCreacion: d.fechaCreacion,
      },
    });
    return bloqueADominio(fila);
  }

  async actualizar(bloque: BloqueProgramacion): Promise<BloqueProgramacion> {
    const d = bloque.aObjeto();
    const fila = await this.cliente.bloqueProgramacion.update({
      where: { id: d.id },
      data: {
        turnoId: d.turnoId,
        productoId: d.productoId,
        horaInicio: d.horaInicio,
        horaFin: d.horaFin,
        cajasPorHora: d.cajasPorHora,
        eficienciaPorcentaje: d.eficienciaPorcentaje,
        loop: d.loop,
        personasAsignadas: d.personasAsignadas,
        cerradoEn: d.cerradoEn,
        cerradoPorId: d.cerradoPorId,
      },
    });
    return bloqueADominio(fila);
  }

  async eliminar(id: string): Promise<void> {
    await this.cliente.bloqueProgramacion.delete({ where: { id } });
  }
}

// ------------------------------------------------------------
// Horarios de turno (lectura) y estándares de producto
// ------------------------------------------------------------

@Injectable()
export class HorarioPrismaRepository implements HorarioRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async vigentesEn(fechaOperativa: Date): Promise<HorarioTurno[]> {
    const filas = await this.cliente.turnoHorario.findMany({
      where: {
        vigenteDesde: { lte: fechaOperativa },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaOperativa } }],
      },
    });
    return filas.map((f) => ({
      turnoId: f.turnoId,
      diaSemana: f.diaSemana,
      horaInicio: f.horaInicio,
      horaFin: f.horaFin,
      cruzaMedianoche: f.cruzaMedianoche,
    }));
  }
}

const CAMPOS_ESTANDAR = {
  id: true,
  codigo: true,
  descripcion: true,
  subdescripcion: true,
  unidadesPorCaja: true,
  cajasPorHora: true,
  pesoNetoKg: true,
} as const;

type RegistroEstandar = Prisma.ProductoGetPayload<{ select: typeof CAMPOS_ESTANDAR }>;

function estandarADominio(r: RegistroEstandar): EstandarProducto {
  return {
    productoId: r.id,
    codigo: r.codigo,
    descripcion: r.descripcion,
    subdescripcion: r.subdescripcion,
    unidadesPorCaja: r.unidadesPorCaja,
    cajasPorHora: numeroONulo(r.cajasPorHora),
    pesoNetoKg: numeroONulo(r.pesoNetoKg),
  };
}

@Injectable()
export class EstandarPrismaRepository implements EstandarRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  async listar(): Promise<EstandarProducto[]> {
    const filas = await this.cliente.producto.findMany({
      where: { activo: true },
      select: CAMPOS_ESTANDAR,
      orderBy: { codigo: 'asc' },
    });
    return filas.map(estandarADominio);
  }

  async buscarPorProducto(productoId: string): Promise<EstandarProducto | null> {
    const fila = await this.cliente.producto.findUnique({ where: { id: productoId }, select: CAMPOS_ESTANDAR });
    return fila ? estandarADominio(fila) : null;
  }

  async actualizar(productoId: string, datos: DatosEstandar): Promise<EstandarProducto> {
    const fila = await this.cliente.producto.update({
      where: { id: productoId },
      data: { cajasPorHora: datos.cajasPorHora, pesoNetoKg: datos.pesoNetoKg },
      select: CAMPOS_ESTANDAR,
    });
    return estandarADominio(fila);
  }
}
