/**
 * CASOS DE USO: BLOQUES DE PROGRAMACIÓN (DPP)
 * ===========================================
 *
 * Guardar un bloque (crear o corregir), eliminarlo, cargar un día
 * completo (importación del DPP o copia de otro día) y cerrar el turno.
 *
 * Reglas comunes:
 *   - el turno del bloque se deriva de su hora de inicio con los
 *     horarios vigentes; si el día no tiene horarios, no se programa;
 *   - corregir o eliminar exige MOTIVO (se audita con valor anterior);
 *   - los bloques de un turno cerrado no se tocan;
 *   - dos bloques de la misma línea no se solapan.
 */

import type { Reloj } from '../remision/crear-remision.use-case.js';
import {
  BloqueProgramacion,
  verificarSinSolapamiento,
  type CambiosBloque,
  type DatosBloque,
  type OrigenBloque,
} from '../../domain/mfr/bloque-programacion.js';
import { calcularBloques, ESTADOS_QUE_CUENTAN, faltantesDelTurno } from '../../domain/mfr/calculo-mfr.js';
import { turnoDeHora, type HorarioRepository } from '../../domain/mfr/horas-turno.js';
import {
  BloqueNoEncontradoError,
  DatosMfrInvalidosError,
  DiaConProgramacionError,
  FaltanteSinMotivoError,
  LineaNoEncontradaError,
  MotivoObligatorioError,
  TurnoCerradoError,
} from '../../domain/mfr/mfr.errors.js';
import type { Producto, ProductoRepository } from '../../domain/producto/producto.repository.js';
import type { ContextoTransaccional, UnidadDeTrabajo } from '../../domain/shared/unidad-de-trabajo.js';

// ------------------------------------------------------------
// Ayudas compartidas
// ------------------------------------------------------------

async function turnoPara(horarios: HorarioRepository, fechaOperativa: Date, horaInicio: string): Promise<string> {
  const turnoId = turnoDeHora(await horarios.vigentesEn(fechaOperativa), fechaOperativa, horaInicio);
  if (!turnoId) {
    throw new DatosMfrInvalidosError('Ese día no tiene horarios de turno configurados; no se puede programar.');
  }
  return turnoId;
}

async function exigirProductoActivo(productos: ProductoRepository, productoId: string): Promise<Producto> {
  const producto = await productos.buscarPorId(productoId);
  if (!producto || !producto.activo) {
    throw new DatosMfrInvalidosError(`El producto "${productoId}" no existe o está inactivo.`);
  }
  return producto;
}

/**
 * Si el bloque no trae personas, se toman las de "línea ideal" del
 * producto (área, 2026-09-19): las necesarias para sacar su producción.
 */
function conPersonasPorDefecto<T extends { personasAsignadas: number | null }>(datos: T, producto: Producto): T {
  return datos.personasAsignadas === null ? { ...datos, personasAsignadas: producto.personasIdeal } : datos;
}

async function exigirLineaActiva(lineas: ContextoTransaccional['lineas'], lineaId: string): Promise<void> {
  const linea = await lineas.buscarPorId(lineaId);
  if (!linea || !linea.activo) {
    throw new LineaNoEncontradaError(`La línea "${lineaId}" no existe o está inactiva.`);
  }
}

// ------------------------------------------------------------
// Guardar (crear o corregir) un bloque
// ------------------------------------------------------------

export interface GuardarBloqueComando extends DatosBloque {
  /** Si viene, se corrige ese bloque (y el motivo es obligatorio). */
  id?: string | null;
  motivo?: string | null;
  usuarioId: string;
}

export class GuardarBloqueUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly productos: ProductoRepository,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: GuardarBloqueComando): Promise<BloqueProgramacion> {
    const producto = await exigirProductoActivo(this.productos, comando.productoId);
    const datos = conPersonasPorDefecto(BloqueProgramacion.validar(comando), producto);
    const turnoId = await turnoPara(this.horarios, datos.fechaOperativa, datos.horaInicio);

    return this.uow.ejecutar(async ({ bloques, lineas, auditoria }) => {
      await exigirLineaActiva(lineas, datos.lineaId);
      const delDia = await bloques.listarPorFecha(datos.fechaOperativa);

      if (!comando.id) {
        const nuevo = BloqueProgramacion.crear(datos, turnoId, 'MANUAL', comando.usuarioId, this.reloj.ahora());
        verificarSinSolapamiento([...delDia.map((b) => b.aObjeto()), nuevo.aObjeto()]);
        const guardado = await bloques.crear(nuevo);
        await auditoria.registrar({
          entidad: 'bloque_programacion',
          entidadId: guardado.id,
          accion: 'CREAR',
          valorNuevo: guardado.aObjeto(),
          usuarioId: comando.usuarioId,
        });
        return guardado;
      }

      // Corrección: el coordinador cambia la meta del día → motivo obligatorio.
      if (!comando.motivo?.trim()) {
        throw new MotivoObligatorioError();
      }
      const existente = delDia.find((b) => b.id === comando.id);
      if (!existente) {
        throw new BloqueNoEncontradoError(`No existe el bloque "${comando.id}" en ese día.`);
      }
      const anterior = existente.aObjeto();
      if (anterior.lineaId !== datos.lineaId) {
        throw new DatosMfrInvalidosError('Un bloque no se mueve de línea: elimínelo y créelo en la otra.');
      }
      const cambios: CambiosBloque = {
        productoId: datos.productoId,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        cajasPorHora: datos.cajasPorHora,
        eficienciaPorcentaje: datos.eficienciaPorcentaje,
        loop: datos.loop,
        personasAsignadas: datos.personasAsignadas,
      };
      existente.editar(cambios, turnoId);
      verificarSinSolapamiento(delDia.map((b) => b.aObjeto()));

      const guardado = await bloques.actualizar(existente);
      await auditoria.registrar({
        entidad: 'bloque_programacion',
        entidadId: guardado.id,
        accion: 'ACTUALIZAR',
        valorAnterior: anterior,
        valorNuevo: guardado.aObjeto(),
        motivo: comando.motivo.trim(),
        usuarioId: comando.usuarioId,
      });
      return guardado;
    });
  }
}

// ------------------------------------------------------------
// Eliminar un bloque
// ------------------------------------------------------------

export class EliminarBloqueUseCase {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  async ejecutar(id: string, motivo: string, usuarioId: string): Promise<void> {
    if (!motivo?.trim()) {
      throw new MotivoObligatorioError();
    }
    await this.uow.ejecutar(async ({ bloques, auditoria }) => {
      const bloque = await bloques.buscarPorId(id);
      if (!bloque) {
        throw new BloqueNoEncontradoError(`No existe el bloque "${id}".`);
      }
      if (bloque.estaCerrado) {
        throw new TurnoCerradoError();
      }
      await bloques.eliminar(id);
      await auditoria.registrar({
        entidad: 'bloque_programacion',
        entidadId: id,
        accion: 'ELIMINAR',
        valorAnterior: bloque.aObjeto(),
        motivo: motivo.trim(),
        usuarioId,
      });
    });
  }
}

// ------------------------------------------------------------
// Cargar un día completo (importación del DPP o copia)
// ------------------------------------------------------------

export interface CargarDiaComando {
  fechaOperativa: Date;
  bloques: Array<Omit<DatosBloque, 'fechaOperativa'>>;
  origen: OrigenBloque;
  /** Si el día ya tiene bloques abiertos: true los elimina primero (exige motivo). */
  reemplazar: boolean;
  motivo?: string | null;
  usuarioId: string;
}

export class CargarDiaUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly productos: ProductoRepository,
    private readonly horarios: HorarioRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: CargarDiaComando): Promise<BloqueProgramacion[]> {
    if (comando.bloques.length === 0) {
      throw new DatosMfrInvalidosError('No hay bloques para cargar.');
    }
    const horarios = await this.horarios.vigentesEn(comando.fechaOperativa);
    const productosPorId = new Map<string, Producto>();
    for (const productoId of new Set(comando.bloques.map((b) => b.productoId))) {
      productosPorId.set(productoId, await exigirProductoActivo(this.productos, productoId));
    }
    const nuevos = comando.bloques.map((b) => {
      const validados = BloqueProgramacion.validar({ ...b, fechaOperativa: comando.fechaOperativa });
      const datos = conPersonasPorDefecto(validados, productosPorId.get(validados.productoId)!);
      const turnoId = turnoDeHora(horarios, comando.fechaOperativa, datos.horaInicio);
      if (!turnoId) {
        throw new DatosMfrInvalidosError('Ese día no tiene horarios de turno configurados; no se puede programar.');
      }
      return BloqueProgramacion.crear(datos, turnoId, comando.origen, comando.usuarioId, this.reloj.ahora());
    });
    verificarSinSolapamiento(nuevos.map((b) => b.aObjeto()));

    return this.uow.ejecutar(async ({ bloques, lineas, auditoria }) => {
      for (const lineaId of new Set(nuevos.map((b) => b.aObjeto().lineaId))) {
        await exigirLineaActiva(lineas, lineaId);
      }

      const existentes = await bloques.listarPorFecha(comando.fechaOperativa);
      if (existentes.length > 0) {
        if (!comando.reemplazar) {
          throw new DiaConProgramacionError(existentes.length);
        }
        if (!comando.motivo?.trim()) {
          throw new MotivoObligatorioError();
        }
        if (existentes.some((b) => b.estaCerrado)) {
          throw new TurnoCerradoError();
        }
        for (const b of existentes) {
          await bloques.eliminar(b.id);
          await auditoria.registrar({
            entidad: 'bloque_programacion',
            entidadId: b.id,
            accion: 'ELIMINAR',
            valorAnterior: b.aObjeto(),
            motivo: comando.motivo.trim(),
            usuarioId: comando.usuarioId,
          });
        }
      }

      const creados: BloqueProgramacion[] = [];
      for (const nuevo of nuevos) {
        const guardado = await bloques.crear(nuevo);
        creados.push(guardado);
        await auditoria.registrar({
          entidad: 'bloque_programacion',
          entidadId: guardado.id,
          accion: 'CREAR',
          valorNuevo: guardado.aObjeto(),
          motivo: comando.motivo?.trim() || undefined,
          usuarioId: comando.usuarioId,
        });
      }
      return creados;
    });
  }
}

// ------------------------------------------------------------
// Copiar la programación de otro día
// ------------------------------------------------------------

export interface CopiarDiaComando {
  desde: Date;
  hacia: Date;
  reemplazar: boolean;
  motivo?: string | null;
  usuarioId: string;
}

export class CopiarDiaUseCase {
  constructor(
    private readonly cargarDia: CargarDiaUseCase,
    private readonly lectura: { listarPorFecha(fecha: Date): Promise<BloqueProgramacion[]> },
  ) {}

  async ejecutar(comando: CopiarDiaComando): Promise<BloqueProgramacion[]> {
    if (comando.desde.getTime() === comando.hacia.getTime()) {
      throw new DatosMfrInvalidosError('El día de origen y el de destino son el mismo.');
    }
    const origen = await this.lectura.listarPorFecha(comando.desde);
    if (origen.length === 0) {
      throw new BloqueNoEncontradoError('El día de origen no tiene programación para copiar.');
    }
    return this.cargarDia.ejecutar({
      fechaOperativa: comando.hacia,
      bloques: origen.map((b) => {
        const d = b.aObjeto();
        return {
          lineaId: d.lineaId,
          productoId: d.productoId,
          horaInicio: d.horaInicio,
          horaFin: d.horaFin,
          cajasPorHora: d.cajasPorHora,
          eficienciaPorcentaje: d.eficienciaPorcentaje,
          loop: d.loop,
          personasAsignadas: d.personasAsignadas,
        };
      }),
      origen: 'COPIA',
      reemplazar: comando.reemplazar,
      motivo: comando.motivo,
      usuarioId: comando.usuarioId,
    });
  }
}

// ------------------------------------------------------------
// Cerrar turno
// ------------------------------------------------------------

export interface CerrarTurnoComando {
  fechaOperativa: Date;
  turnoId: string;
  /** Obligatorio si algún SKU del turno quedó por debajo de su target ("ni menos"). */
  motivoFaltante?: string | null;
  usuarioId: string;
}

/**
 * Cierra (congela) todos los bloques de un turno.
 *
 * "Ni menos de lo planeado" (área, 2026-09-18): si al cerrar hay SKU
 * con menos cajas aprobadas que su target, el cierre exige un motivo
 * que queda auditado junto con los faltantes.
 */
export class CerrarTurnoUseCase {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(comando: CerrarTurnoComando): Promise<BloqueProgramacion[]> {
    return this.uow.ejecutar(async ({ bloques, auditoria, estandares, remisiones }) => {
      const delDia = await bloques.listarPorFecha(comando.fechaOperativa);
      const delTurno = delDia.filter((b) => b.aObjeto().turnoId === comando.turnoId);
      if (delTurno.length === 0) {
        throw new BloqueNoEncontradoError('El turno no tiene bloques programados.');
      }
      const abiertos = delTurno.filter((b) => !b.estaCerrado);
      if (abiertos.length === 0) {
        throw new TurnoCerradoError();
      }

      const [listaEstandares, produccion] = await Promise.all([
        estandares.listar(),
        remisiones.totalizarCajas(comando.fechaOperativa, ESTADOS_QUE_CUENTAN),
      ]);
      const faltantes = faltantesDelTurno(
        comando.turnoId,
        calcularBloques(delTurno.map((b) => b.aObjeto()), listaEstandares),
        produccion,
      );
      const motivo = comando.motivoFaltante?.trim() || null;
      if (faltantes.length > 0 && !motivo) {
        throw new FaltanteSinMotivoError(faltantes);
      }

      const momento = this.reloj.ahora();
      const cerrados: BloqueProgramacion[] = [];
      for (const bloque of abiertos) {
        bloque.cerrar(comando.usuarioId, momento);
        const guardado = await bloques.actualizar(bloque);
        cerrados.push(guardado);
        await auditoria.registrar({
          entidad: 'bloque_programacion',
          entidadId: guardado.id,
          accion: 'CAMBIO_ESTADO',
          valorNuevo: { cerradoEn: momento, faltantes: faltantes.length > 0 ? faltantes : undefined },
          motivo,
          usuarioId: comando.usuarioId,
        });
      }
      return cerrados;
    });
  }
}
