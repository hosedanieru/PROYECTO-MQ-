/**
 * UNIDAD DE TRABAJO (UNIT OF WORK)
 * ================================
 *
 * Agrupa varias escrituras en una sola transacción: o se confirman
 * todas, o no se confirma ninguna.
 *
 * Existe por un requisito del negocio: la auditoría debe quedar
 * garantizada. Si no se puede registrar el rastro de una operación, la
 * operación no debe completarse. Con auditoría por fuera de la
 * transacción eso no se puede asegurar.
 *
 *   uow.ejecutar(async ({ remisiones, auditoria }) => {
 *     await remisiones.actualizar(remision);
 *     await auditoria.registrar({ ... });
 *   });
 *   // Si la auditoría falla, la remisión tampoco se guarda.
 *
 * Los repositorios ya NO abren transacciones por su cuenta: esa
 * responsabilidad es de la unidad de trabajo. Así una operación puede
 * tocar varias entidades y seguir siendo atómica.
 */

import type { AuditoriaRepository } from '../auditoria/auditoria.repository.js';
import type { CausalAveriaRepository } from '../averia/causal-averia.js';
import type { ReporteAveriaRepository } from '../averia/reporte-averia.js';
import type { GrupoRepository } from '../grupo/grupo.repository.js';
import type { EnvioCorreoRepository, ListaDistribucionRepository } from '../correo/correo.js';
import type { CierreInventarioRepository } from '../inventario/cierre-inventario.js';
import type { EntradaMercanciaRepository } from '../inventario/entrada-mercancia.js';
import type { ItemInventarioRepository } from '../inventario/item-inventario.js';
import type { MaterialRepository } from '../inventario/material.js';
import type { RecetaRepository } from '../inventario/receta.js';
import type { UnidadMedidaRepository } from '../inventario/unidad-medida.js';
import type { MovimientoInventarioRepository } from '../inventario/movimiento-inventario.js';
import type { AsignacionRepository } from '../mfr/asignacion-linea.js';
import type { AsistenciaRepository } from '../mfr/asistencia-turno.js';
import type { BloqueRepository } from '../mfr/bloque-programacion.js';
import type { EstandarRepository } from '../mfr/estandar-produccion.js';
import type { AjusteEsperadasRepository } from '../mfr/esperadas-personal.js';
import type { LineaRepository } from '../mfr/linea-produccion.js';
import type { ProductoRepository } from '../producto/producto.repository.js';
import type { RemisionRepository } from '../remision/remision.repository.js';
import type { FirmaRemisionRepository } from '../remision/firma-remision.js';
import type { ResumenTurnoRepository } from '../resumen/resumen-turno.js';
import type { UsuarioRepository } from '../usuario/usuario.repository.js';

/**
 * Repositorios ligados a una transacción abierta.
 *
 * A medida que se agreguen módulos (averías, calidad, inventario), sus
 * repositorios se suman aquí y quedan disponibles dentro de la misma
 * transacción.
 */
export interface ContextoTransaccional {
  remisiones: RemisionRepository;
  firmasRemision: FirmaRemisionRepository;
  usuarios: UsuarioRepository;
  productos: ProductoRepository;
  grupos: GrupoRepository;
  auditoria: AuditoriaRepository;
  // MFR
  bloques: BloqueRepository;
  lineas: LineaRepository;
  estandares: EstandarRepository;
  asistencias: AsistenciaRepository;
  asignaciones: AsignacionRepository;
  ajustesEsperadas: AjusteEsperadasRepository;
  // Averías
  causales: CausalAveriaRepository;
  reportesAveria: ReporteAveriaRepository;
  // Inventario
  itemsInventario: ItemInventarioRepository;
  movimientosInventario: MovimientoInventarioRepository;
  entradasMercancia: EntradaMercanciaRepository;
  materiales: MaterialRepository;
  unidadesMedida: UnidadMedidaRepository;
  recetas: RecetaRepository;
  cierresInventario: CierreInventarioRepository;
  // Correo
  listasDistribucion: ListaDistribucionRepository;
  enviosCorreo: EnvioCorreoRepository;
  // Resumen del turno
  resumenesTurno: ResumenTurnoRepository;
}

export interface UnidadDeTrabajo {
  ejecutar<T>(
    trabajo: (contexto: ContextoTransaccional) => Promise<T>,
  ): Promise<T>;
}

export const UNIDAD_DE_TRABAJO = Symbol('UnidadDeTrabajo');
