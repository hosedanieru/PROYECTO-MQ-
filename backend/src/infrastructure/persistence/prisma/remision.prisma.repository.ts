/**
 * REPOSITORIO DE REMISIONES — Implementación con Prisma
 * ====================================================
 *
 * CAMBIO IMPORTANTE: este repositorio ya NO abre transacciones.
 *
 * Antes cada método manejaba su propia transacción. Ahora la
 * transacción la abre la unidad de trabajo, y aquí se recibe el cliente
 * ya ligado a ella. Eso permite que una operación de negocio agrupe
 * varias escrituras (remisión + auditoría + versión) de forma atómica.
 *
 * Los métodos de ESCRITURA deben invocarse dentro de una unidad de
 * trabajo. Los de LECTURA funcionan igual dentro o fuera, porque una
 * consulta suelta ya es atómica por sí misma.
 */

import { Injectable } from '@nestjs/common';

import type { EstadoRemision, Remision } from '../../../domain/remision/remision.entity.js';
import {
  conteoEnCero,
  type CajasAgrupadas,
  type ConteoPorEstado,
  type FiltroRemisiones,
  type RemisionRepository,
  type ResultadoPaginado,
} from '../../../domain/remision/remision.repository.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { ClientePrisma } from './cliente-prisma.js';
import { RemisionMapper, type RegistroRemision } from './remision.mapper.js';

const TIPO_CONSECUTIVO = 'REMISION';
const INCLUIR_ESTIBAS = { estibas: true } as const;

@Injectable()
export class RemisionPrismaRepository implements RemisionRepository {
  constructor(private readonly cliente: ClientePrisma) { }

  /**
   * Reserva el consecutivo del año y guarda la remisión.
   *
   * Debe ejecutarse dentro de una unidad de trabajo: el bloqueo de fila
   * (SELECT ... FOR UPDATE) solo sirve si hay una transacción abierta.
   * Si dos coordinadores crean una remisión en el mismo instante, el
   * segundo espera a que el primero confirme y obtiene el número
   * siguiente. Con un `SELECT MAX(numero) + 1` ambos obtendrían el
   * mismo — inaceptable en un documento con valor legal.
   */
  async crearConConsecutivo(
    construir: (anio: number, numero: number) => Remision,
    anio: number,
  ): Promise<Remision> {
    // Asegura que exista la fila del año antes de bloquearla.
    await this.cliente.$executeRaw`
      INSERT INTO consecutivo (id, tipo, anio, ultimo)
      VALUES (gen_random_uuid(), ${TIPO_CONSECUTIVO}, ${anio}, 0)
      ON CONFLICT (tipo, anio) DO NOTHING
    `;

    const filas = await this.cliente.$queryRaw<Array<{ ultimo: number }>>`
      SELECT ultimo
      FROM consecutivo
      WHERE tipo = ${TIPO_CONSECUTIVO} AND anio = ${anio}
      FOR UPDATE
    `;

    if (filas.length === 0) {
      throw new Error(
        `No se pudo reservar el consecutivo de remisiones para ${anio}.`,
      );
    }

    const numero = Number(filas[0].ultimo) + 1;

    await this.cliente.$executeRaw`
      UPDATE consecutivo
      SET ultimo = ${numero}
      WHERE tipo = ${TIPO_CONSECUTIVO} AND anio = ${anio}
    `;

    // Si la entidad rechaza los datos, la transacción revierte y el
    // número no se consume: no quedan huecos en la numeración.
    const remision = construir(anio, numero);

    const registro = await this.cliente.remision.create({
      data: RemisionMapper.aCreacion(remision),
      include: INCLUIR_ESTIBAS,
    });

    return RemisionMapper.aDominio(registro);
  }

  async actualizar(remision: Remision): Promise<Remision> {
    const datos = remision.aObjeto();

    await this.cliente.remision.update({
      where: { id: datos.id },
      data: RemisionMapper.aActualizacion(remision),
    });

    // Las estibas se reemplazan en bloque: una rectificación puede
    // cambiar cuáles son, y reconciliar diferencia por diferencia
    // sería más código para el mismo resultado.
    await this.cliente.remisionEstiba.deleteMany({
      where: { remisionId: datos.id },
    });

    if (datos.numerosEstiba.length > 0) {
      await this.cliente.remisionEstiba.createMany({
        data: datos.numerosEstiba.map((numeroEstiba) => ({
          remisionId: datos.id,
          numeroEstiba,
        })),
      });
    }

    const registro = await this.cliente.remision.findUniqueOrThrow({
      where: { id: datos.id },
      include: INCLUIR_ESTIBAS,
    });

    return RemisionMapper.aDominio(registro);
  }

  async registrarVersion(parametros: {
    remisionId: string;
    version: number;
    motivoRechazo: string | null;
    datosAnteriores: unknown;
    rectificadaPorId: string;
  }): Promise<void> {
    await this.cliente.remisionVersion.create({
      data: {
        remisionId: parametros.remisionId,
        version: parametros.version,
        motivoRechazo: parametros.motivoRechazo,
        datosAnteriores: JSON.parse(
          JSON.stringify(parametros.datosAnteriores),
        ) as Prisma.InputJsonValue,
        rectificadaPorId: parametros.rectificadaPorId,
      },
    });
  }

  async buscarPorId(id: string): Promise<Remision | null> {
    const registro = await this.cliente.remision.findUnique({
      where: { id },
      include: INCLUIR_ESTIBAS,
    });

    return registro ? RemisionMapper.aDominio(registro) : null;
  }

  async buscarPorConsecutivo(
    anio: number,
    numero: number,
  ): Promise<Remision | null> {
    const registro = await this.cliente.remision.findUnique({
      where: { anio_numero: { anio, numero } },
      include: INCLUIR_ESTIBAS,
    });

    return registro ? RemisionMapper.aDominio(registro) : null;
  }

  async listar(filtro: FiltroRemisiones): Promise<ResultadoPaginado<Remision>> {
    const pagina = Math.max(1, filtro.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, filtro.porPagina ?? 20));
    const where = this.construirWhere(filtro);

    const registros = await this.cliente.remision.findMany({
      where,
      include: INCLUIR_ESTIBAS,
      // Orden operativo: lo más reciente primero.
      orderBy: [{ fechaOperativa: 'desc' }, { numero: 'desc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    });

    const total = await this.cliente.remision.count({ where });

    return {
      items: registros.map((r: RegistroRemision) => RemisionMapper.aDominio(r)),
      total,
      pagina,
      porPagina,
    };
  }

  /** Tope de filas para exportar/imprimir; ~2 años de operación. */
  private static readonly TOPE_EXPORTACION = 5000;

  async listarTodas(
    filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina'>,
  ): Promise<Remision[]> {
    const registros = await this.cliente.remision.findMany({
      where: this.construirWhere(filtro),
      include: INCLUIR_ESTIBAS,
      orderBy: [{ fechaOperativa: 'asc' }, { anio: 'asc' }, { numero: 'asc' }],
      take: RemisionPrismaRepository.TOPE_EXPORTACION,
    });
    return registros.map((r: RegistroRemision) => RemisionMapper.aDominio(r));
  }

  async buscarPorIds(ids: string[]): Promise<Remision[]> {
    if (ids.length === 0) {
      return [];
    }
    const registros = await this.cliente.remision.findMany({
      where: { id: { in: ids } },
      include: INCLUIR_ESTIBAS,
    });
    const porId = new Map(registros.map((r) => [r.id, RemisionMapper.aDominio(r)]));
    return ids.map((id) => porId.get(id)).filter((r): r is Remision => r !== undefined);
  }

  /** Cuenta en la base con GROUP BY: no trae ni una fila de remisión. */
  async contarPorEstado(
    filtro: Omit<FiltroRemisiones, 'pagina' | 'porPagina' | 'estado'>,
  ): Promise<ConteoPorEstado> {
    const grupos = await this.cliente.remision.groupBy({
      by: ['estado'],
      where: this.construirWhere(filtro),
      _count: { _all: true },
    });

    const conteo = conteoEnCero();
    for (const grupo of grupos) {
      conteo[RemisionMapper.estadoADominio(grupo.estado)] = grupo._count._all;
    }
    return conteo;
  }

  async totalizarCajas(
    fechaOperativa: Date,
    estados: readonly EstadoRemision[],
  ): Promise<CajasAgrupadas[]> {
    const grupos = await this.cliente.remision.groupBy({
      by: ['turnoId', 'productoId', 'extraoficial'],
      where: {
        fechaOperativa,
        estado: { in: estados.map((e) => RemisionMapper.estadoAPrisma(e)) },
      },
      _sum: { cantidadCajas: true },
    });
    return grupos.map((g) => ({
      turnoId: g.turnoId,
      productoId: g.productoId,
      extraoficial: g.extraoficial,
      cajas: g._sum.cantidadCajas ?? 0,
    }));
  }

  private construirWhere(filtro: FiltroRemisiones): Prisma.RemisionWhereInput {
    const where: Prisma.RemisionWhereInput = {};

    if (filtro.anio !== undefined) {
      where.anio = filtro.anio;
    }
    if (filtro.turnoId) {
      where.turnoId = filtro.turnoId;
    }
    if (filtro.grupoId) {
      where.grupoId = filtro.grupoId;
    }
    if (filtro.productoId) {
      where.productoId = filtro.productoId;
    }
    if (filtro.estado) {
      where.estado = RemisionMapper.estadoAPrisma(filtro.estado);
    }

    // Los rangos se filtran por fecha operativa, nunca por fecha
    // calendario: es la regla del corte 06:00 a 06:00.
    if (filtro.fechaOperativaDesde || filtro.fechaOperativaHasta) {
      where.fechaOperativa = {
        ...(filtro.fechaOperativaDesde && { gte: filtro.fechaOperativaDesde }),
        ...(filtro.fechaOperativaHasta && { lte: filtro.fechaOperativaHasta }),
      };
    }

    return where;
  }
}