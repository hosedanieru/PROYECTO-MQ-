/**
 * CASO DE USO: EDITAR REMISIÓN
 * ============================
 *
 * Corrige los datos de una remisión que todavía no salió a entrega
 * (BORRADOR) o que volvió para corregirse (EN_RECTIFICACION). Es lo que
 * le da sentido a rectificar: sin esto, la versión nueva saldría con
 * los mismos datos que el OPA rechazó.
 *
 * Secuencia:
 *   1. Si cambia el producto, lo busca, exige que esté activo y toma el
 *      snapshot nuevo (código y descripción).
 *   2. Dentro de la unidad de trabajo: carga, aplica `editar()` (la
 *      entidad decide si el estado lo permite y revalida todo), guarda
 *      y audita con valor anterior y nuevo.
 *
 * No cambia versión ni estado: eso es del flujo, no de la edición.
 */

import type { ProductoRepository } from '../../domain/producto/producto.repository.js';
import type {
  DatosEditablesRemision,
  Remision,
} from '../../domain/remision/remision.entity.js';
import {
  DatosRemisionInvalidosError,
  RemisionNoEncontradaError,
} from '../../domain/remision/remision.errors.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';
import { verificarContraProgramacion } from './control-programacion.js';

export interface EditarRemisionComando {
  remisionId: string;
  cambios: Omit<DatosEditablesRemision, 'producto'> & { productoId?: string };
  editadaPorId: string;
}

export class EditarRemisionUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly productos: ProductoRepository,
  ) {}

  async ejecutar(comando: EditarRemisionComando): Promise<Remision> {
    const { productoId, ...resto } = comando.cambios;

    let producto: DatosEditablesRemision['producto'];
    if (productoId !== undefined) {
      const encontrado = await this.productos.buscarPorId(productoId);
      if (!encontrado) {
        throw new DatosRemisionInvalidosError(
          `No existe el producto con id "${productoId}".`,
        );
      }
      if (!encontrado.activo) {
        throw new DatosRemisionInvalidosError(
          `El producto ${encontrado.codigo} está inactivo y no puede remisionarse.`,
        );
      }
      producto = {
        id: encontrado.id,
        codigo: encontrado.codigo,
        descripcion: encontrado.descripcion,
      };
    }

    return this.uow.ejecutar(async ({ remisiones, auditoria, bloques, estandares }) => {
      const remision = await remisiones.buscarPorId(comando.remisionId);
      if (!remision) {
        throw new RemisionNoEncontradaError(
          `No existe la remisión "${comando.remisionId}".`,
        );
      }

      const anterior = remision.aObjeto();
      remision.editar({ ...resto, producto });

      // El documento editado debe seguir cabiendo en el DPP del día
      // (o ser extraoficial). Se verifica antes de escribir.
      const editada = remision.aObjeto();
      await verificarContraProgramacion(
        { bloques, estandares, remisiones },
        {
          fechaOperativa: editada.fechaOperativa,
          productoId: editada.productoId,
          codigoProducto: editada.codigoSnapshot,
          cantidadCajas: editada.cantidadCajas,
          extraoficial: editada.extraoficial,
        },
      );

      const guardada = await remisiones.actualizar(remision);

      await auditoria.registrar({
        entidad: 'remision',
        entidadId: guardada.id,
        accion: 'ACTUALIZAR',
        valorAnterior: anterior,
        valorNuevo: guardada.aObjeto(),
        usuarioId: comando.editadaPorId,
      });

      return guardada;
    });
  }
}
