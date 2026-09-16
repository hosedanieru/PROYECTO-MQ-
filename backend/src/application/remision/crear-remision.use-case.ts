/**
 * CASO DE USO: CREAR REMISIÓN
 * ===========================
 *
 * La creación ocurre dentro de una unidad de trabajo, junto con su
 * auditoría. Si la auditoría falla, la remisión no se crea y el
 * consecutivo no se consume.
 *
 * Secuencia:
 *   1. Verifica que el producto exista y esté activo.
 *   2. Calcula el día operativo según el corte 06:00 a 06:00.
 *   3. Abre la transacción.
 *   4. Reserva el consecutivo con bloqueo de fila y guarda.
 *   5. Audita la creación.
 *
 * El caso de uso COORDINA; no contiene reglas de negocio (viven en la
 * entidad) ni conoce la base de datos (eso es del repositorio).
 */

import type { ProductoRepository } from '../../domain/producto/producto.repository.js';
import { Remision } from '../../domain/remision/remision.entity.js';
import { DatosRemisionInvalidosError } from '../../domain/remision/remision.errors.js';
import { registroActual } from '../../domain/shared/fecha-operativa.js';
import type { UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

/**
 * Fuente de la hora actual.
 *
 * Se abstrae en lugar de llamar a `new Date()` dentro del caso de uso
 * para poder probar los casos borde del corte de las 06:00 sin depender
 * de cuándo se ejecuten las pruebas.
 */
export interface Reloj {
  ahora(): Date;
}

export const RELOJ = Symbol('Reloj');

export interface CrearRemisionComando {
  turnoId: string;
  proveedorId: string;
  lugarId: string;
  productoId: string;
  fechaVencimiento: Date;
  cantidadCajas: number;
  cantidadUnidades: number;
  estibasCompletas: number;
  cajasSueltas: number;
  numerosEstiba: number[];
  observaciones?: string | null;
  creadaPorId: string;
}

export class CrearRemisionUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly productos: ProductoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: CrearRemisionComando): Promise<Remision> {
    const producto = await this.productos.buscarPorId(comando.productoId);

    if (!producto) {
      throw new DatosRemisionInvalidosError(
        `No existe el producto con id "${comando.productoId}".`,
      );
    }
    if (!producto.activo) {
      throw new DatosRemisionInvalidosError(
        `El producto ${producto.codigo} está inactivo y no puede remisionarse.`,
      );
    }

    const { fechaHoraRegistro, fechaOperativa } = registroActual(
      this.reloj.ahora(),
    );

    /**
     * El año del consecutivo sale de la FECHA OPERATIVA, no del
     * calendario. Una remisión creada el 1 de enero a las 02:00
     * pertenece al 31 de diciembre anterior, y por tanto lleva el
     * consecutivo del año que cierra.
     */
    const anio = fechaOperativa.getUTCFullYear();

    return this.uow.ejecutar(async ({ remisiones, auditoria }) => {
      const remision = await remisiones.crearConConsecutivo(
        (anioAsignado, numeroAsignado) =>
          Remision.crear({
            anio: anioAsignado,
            numero: numeroAsignado,
            fechaOperativa,
            fechaHoraRegistro,
            turnoId: comando.turnoId,
            proveedorId: comando.proveedorId,
            lugarId: comando.lugarId,
            productoId: producto.id,
            // Copia congelada: la remisión es un documento firmado y debe
            // seguir mostrando lo que decía cuando se firmó, aunque el
            // catálogo cambie después.
            codigoSnapshot: producto.codigo,
            descripcionSnapshot: producto.descripcion,
            fechaVencimiento: comando.fechaVencimiento,
            cantidadCajas: comando.cantidadCajas,
            cantidadUnidades: comando.cantidadUnidades,
            estibasCompletas: comando.estibasCompletas,
            cajasSueltas: comando.cajasSueltas,
            numerosEstiba: comando.numerosEstiba,
            observaciones: comando.observaciones ?? null,
            creadaPorId: comando.creadaPorId,
          }),
        anio,
      );

      await auditoria.registrar({
        entidad: 'remision',
        entidadId: remision.id,
        accion: 'CREAR',
        valorNuevo: remision.aObjeto(),
        usuarioId: comando.creadaPorId,
      });

      return remision;
    });
  }
}
