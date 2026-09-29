/**
 * CASOS DE USO: INVENTARIO
 * ========================
 *
 *   CrearItemUseCase            el administrador da de alta un insumo, PI o PT
 *   ActualizarItemUseCase       corrige código, descripción, unidad; desactiva
 *   RegistrarMovimientoUseCase  entrada, salida o ajuste, con su saldo
 *   RegistrarEntradaMercanciaUseCase  lo que llega en un documento: varias líneas, todo o nada
 *
 * Todo con auditoría dentro de la misma transacción.
 */

import {
  TIPOS_ITEM_ENTRADA,
  validarEntrada,
  type DatosEntrada,
  type EntradaMercancia,
} from '../../domain/inventario/entrada-mercancia.js';
import {
  DatosInventarioInvalidosError,
  ItemInventarioDuplicadoError,
  ItemInventarioNoEncontradoError,
} from '../../domain/inventario/inventario.errors.js';
import {
  validarDatosItem,
  type CambiosItem,
  type DatosItem,
  type ItemInventario,
} from '../../domain/inventario/item-inventario.js';
import {
  aplicarMovimiento,
  type DatosMovimiento,
  type MovimientoInventario,
} from '../../domain/inventario/movimiento-inventario.js';
import type { HorarioRepository } from '../../domain/mfr/horas-turno.js';
import { ProductoNoEncontradoError } from '../../domain/producto/producto.errors.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import type { Reloj } from '../remision/crear-remision.use-case.js';
import { momentoOperativo } from '../shared/momento-operativo.js';

export interface CrearItemComando extends DatosItem {
  usuarioId: string;
}

export class CrearItemUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: CrearItemComando): Promise<ItemInventario> {
    const datos = validarDatosItem(comando);
    return this.uow.ejecutar(async ({ itemsInventario, productos, auditoria }) => {
      if (datos.tipo === 'PT') {
        const producto = await productos.buscarPorId(datos.productoId!);
        if (!producto || !producto.activo) {
          throw new ProductoNoEncontradoError('El producto no existe o está inactivo.');
        }
        if (await itemsInventario.buscarPorProducto(producto.id)) {
          throw new ItemInventarioDuplicadoError(`El producto ${producto.codigo} ya tiene su ítem de inventario.`);
        }
      } else if (await itemsInventario.buscarPorCodigo(datos.codigo!)) {
        throw new ItemInventarioDuplicadoError(`Ya existe un ítem de inventario con el código "${datos.codigo}".`);
      }

      const creado = await itemsInventario.crear(datos);
      await auditoria.registrar({
        entidad: 'item_inventario',
        entidadId: creado.id,
        accion: 'CREAR',
        valorNuevo: creado,
        usuarioId: comando.usuarioId,
      });
      return creado;
    });
  }
}

export interface ActualizarItemComando {
  itemId: string;
  cambios: CambiosItem;
  usuarioId: string;
}

export class ActualizarItemUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(comando: ActualizarItemComando): Promise<ItemInventario> {
    return this.uow.ejecutar(async ({ itemsInventario, auditoria }) => {
      const actual = await buscarItem(itemsInventario, comando.itemId);
      const { activo, ...cambios } = Object.fromEntries(
        Object.entries(comando.cambios).filter(([, v]) => v !== undefined),
      ) as CambiosItem;

      if (actual.tipo === 'PT' && (cambios.codigo !== undefined || cambios.descripcion !== undefined || activo !== undefined)) {
        throw new DatosInventarioInvalidosError('Código, descripción y estado del PT se cambian desde su producto (pestaña Productos).');
      }
      // Se revalida el ítem completo con los cambios aplicados.
      const datos = validarDatosItem({
        tipo: actual.tipo,
        productoId: actual.productoId,
        codigo: cambios.codigo ?? actual.codigo,
        descripcion: cambios.descripcion ?? actual.descripcion,
        unidadMedida: cambios.unidadMedida ?? actual.unidadMedida,
      });
      if (datos.codigo && datos.codigo !== actual.codigo) {
        const otro = await itemsInventario.buscarPorCodigo(datos.codigo);
        if (otro && otro.id !== actual.id) {
          throw new ItemInventarioDuplicadoError(`Ya existe un ítem de inventario con el código "${datos.codigo}".`);
        }
      }

      const actualizado = await itemsInventario.actualizar(actual.id, {
        ...(datos.tipo !== 'PT' ? { codigo: datos.codigo!, descripcion: datos.descripcion! } : {}),
        unidadMedida: datos.unidadMedida,
        ...(activo !== undefined ? { activo } : {}),
      });
      await auditoria.registrar({
        entidad: 'item_inventario',
        entidadId: actual.id,
        accion: 'ACTUALIZAR',
        valorAnterior: actual,
        valorNuevo: actualizado,
        usuarioId: comando.usuarioId,
      });
      return actualizado;
    });
  }
}

export interface RegistrarMovimientoComando extends DatosMovimiento {
  itemId: string;
  usuarioId: string;
}

export class RegistrarMovimientoUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarMovimientoComando): Promise<{ movimiento: MovimientoInventario; item: ItemInventario }> {
    // Fecha, hora y turno los pone el servidor, igual que en averías.
    const momento = await momentoOperativo(this.reloj, this.horarios);

    return this.uow.ejecutar(async ({ itemsInventario, movimientosInventario, usuarios, auditoria }) => {
      // Lecturas primero (regla de Firestore); el ítem queda bloqueado.
      const usuario = await usuarios.buscarPorId(comando.usuarioId);
      const item = await itemsInventario.bloquearParaMovimiento(comando.itemId);
      if (!item || !item.activo) {
        throw new ItemInventarioNoEncontradoError('El ítem de inventario no existe o está inactivo.');
      }

      const calculado = aplicarMovimiento(item.existencia, comando, item.unidadMedida);
      const movimiento = await movimientosInventario.crear({
        itemId: item.id,
        tipo: calculado.datos.tipo,
        cantidad: calculado.cantidad,
        saldo: calculado.saldo,
        ...momento,
        usuarioId: comando.usuarioId,
        usuarioNombre: usuario?.nombre ?? comando.usuarioId,
        referencia: calculado.datos.referencia,
        observacion: calculado.datos.observacion,
        motivo: calculado.datos.motivo,
        entradaId: null,
      });
      await itemsInventario.fijarExistencia(item.id, calculado.saldo);
      await auditoria.registrar({
        entidad: 'movimiento_inventario',
        entidadId: movimiento.id,
        accion: 'CREAR',
        valorAnterior: { existencia: item.existencia },
        valorNuevo: movimiento,
        motivo: movimiento.motivo,
        usuarioId: comando.usuarioId,
      });
      return { movimiento, item: { ...item, existencia: calculado.saldo } };
    });
  }
}

export interface RegistrarEntradaComando extends DatosEntrada {
  usuarioId: string;
}

export interface LineaEntradaRegistrada {
  movimientoId: string;
  itemId: string;
  codigo: string;
  descripcion: string;
  unidadMedida: string;
  cantidad: number;
  saldo: number;
}

export class RegistrarEntradaMercanciaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: RegistrarEntradaComando): Promise<EntradaMercancia & { lineas: LineaEntradaRegistrada[] }> {
    const datos = validarEntrada(comando);
    const momento = await momentoOperativo(this.reloj, this.horarios);

    return this.uow.ejecutar(async ({ itemsInventario, movimientosInventario, entradasMercancia, usuarios, auditoria }) => {
      // 1. Lecturas (regla de Firestore). Los ítems se bloquean SIEMPRE en
      //    el mismo orden (por id): dos entradas simultáneas con los mismos
      //    ítems en otro orden se esperarían mutuamente (deadlock).
      const usuario = await usuarios.buscarPorId(comando.usuarioId);
      const items = new Map<string, ItemInventario>();
      for (const id of [...new Set(datos.lineas.map((l) => l.itemId))].sort()) {
        const item = await itemsInventario.bloquearParaMovimiento(id);
        if (item) items.set(id, item);
      }
      const calculadas = datos.lineas.map((l, i) => {
        const item = items.get(l.itemId);
        if (!item || !item.activo) {
          throw new ItemInventarioNoEncontradoError(`Línea ${i + 1}: el ítem no existe o está inactivo.`);
        }
        if (!TIPOS_ITEM_ENTRADA.includes(item.tipo)) {
          throw new DatosInventarioInvalidosError(`Línea ${i + 1}: ${item.codigo} es ${item.tipo}; la entrada de mercancía recibe insumos y PI.`);
        }
        const calculo = aplicarMovimiento(
          item.existencia,
          { tipo: 'ENTRADA', cantidad: l.cantidad, referencia: datos.documento, observacion: null, motivo: null },
          item.unidadMedida,
        );
        return { item, calculo };
      });

      // 2. Escrituras: encabezado, un movimiento por línea y existencias.
      const entrada = await entradasMercancia.crear({
        documento: datos.documento,
        remitente: datos.remitente,
        observacion: datos.observacion,
        ...momento,
        usuarioId: comando.usuarioId,
        usuarioNombre: usuario?.nombre ?? comando.usuarioId,
      });
      const lineas: LineaEntradaRegistrada[] = [];
      for (const { item, calculo } of calculadas) {
        const movimiento = await movimientosInventario.crear({
          itemId: item.id,
          tipo: 'ENTRADA',
          cantidad: calculo.cantidad,
          saldo: calculo.saldo,
          ...momento,
          usuarioId: comando.usuarioId,
          usuarioNombre: entrada.usuarioNombre,
          referencia: datos.documento,
          observacion: null,
          motivo: null,
          entradaId: entrada.id,
        });
        await itemsInventario.fijarExistencia(item.id, calculo.saldo);
        lineas.push({
          movimientoId: movimiento.id,
          itemId: item.id,
          codigo: item.codigo,
          descripcion: item.descripcion,
          unidadMedida: item.unidadMedida,
          cantidad: calculo.cantidad,
          saldo: calculo.saldo,
        });
      }
      await auditoria.registrar({
        entidad: 'entrada_mercancia',
        entidadId: entrada.id,
        accion: 'CREAR',
        valorNuevo: { ...entrada, lineas },
        usuarioId: comando.usuarioId,
      });
      return { ...entrada, lineas };
    });
  }
}

async function buscarItem(repo: ContextoTransaccional['itemsInventario'], id: string): Promise<ItemInventario> {
  const item = await repo.buscarPorId(id);
  if (!item) throw new ItemInventarioNoEncontradoError(`No existe el ítem de inventario "${id}".`);
  return item;
}
