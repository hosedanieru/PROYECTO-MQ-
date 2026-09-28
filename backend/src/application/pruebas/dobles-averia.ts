/**
 * DOBLES DE PRUEBA — Averías
 * ==========================
 *
 * Solo se importan desde archivos `*.spec.ts`.
 */

import type { AlmacenDeEvidencias, ArchivoEvidencia } from '../../domain/averia/almacen-evidencias.js';
import {
  ordenarCausales,
  type CausalAveria,
  type CausalAveriaRepository,
  type DatosCausal,
} from '../../domain/averia/causal-averia.js';
import type {
  FiltroReportesAveria,
  NuevoReporteAveria,
  ReporteAveria,
  ReporteAveriaRepository,
} from '../../domain/averia/reporte-averia.js';

export class ReporteAveriaRepositorioFalso implements ReporteAveriaRepository {
  readonly porId = new Map<string, ReporteAveria>();
  private secuencia = 0;

  crear(nuevo: NuevoReporteAveria): Promise<ReporteAveria> {
    const id = `rep-${++this.secuencia}`;
    const reporte: ReporteAveria = { ...nuevo, id, registros: nuevo.registros.map((r, i) => ({ ...r, id: `${id}-r${i}` })) };
    this.porId.set(id, structuredClone(reporte));
    return Promise.resolve(reporte);
  }

  buscarPorId(id: string): Promise<ReporteAveria | null> {
    const r = this.porId.get(id);
    return Promise.resolve(r ? structuredClone(r) : null);
  }

  listar(filtro: FiltroReportesAveria): Promise<ReporteAveria[]> {
    return Promise.resolve(
      [...this.porId.values()].filter((r) => r.fechaOperativa >= filtro.desde && r.fechaOperativa <= filtro.hasta),
    );
  }

  actualizar(reporte: ReporteAveria): Promise<ReporteAveria> {
    this.porId.set(reporte.id, structuredClone(reporte));
    return Promise.resolve(reporte);
  }
}

/** Almacén en memoria; `fallarAlGuardarNumero` simula un disco que falla en la N-ésima foto. */
export class AlmacenEvidenciasFalso implements AlmacenDeEvidencias {
  readonly archivos = new Map<string, ArchivoEvidencia>();
  fallarAlGuardarNumero: number | null = null;
  private secuencia = 0;

  guardar(archivo: ArchivoEvidencia): Promise<string> {
    this.secuencia += 1;
    if (this.secuencia === this.fallarAlGuardarNumero) return Promise.reject(new Error('Disco lleno (simulado)'));
    const ruta = `2026/09/foto-${this.secuencia}.jpg`;
    this.archivos.set(ruta, archivo);
    return Promise.resolve(ruta);
  }

  leer(ruta: string): Promise<ArchivoEvidencia | null> {
    return Promise.resolve(this.archivos.get(ruta) ?? null);
  }

  eliminar(ruta: string): Promise<void> {
    this.archivos.delete(ruta);
    return Promise.resolve();
  }
}

export class CausalRepositorioFalso implements CausalAveriaRepository {
  readonly items: CausalAveria[] = [];
  private secuencia = 0;

  agregar(causal: CausalAveria): void {
    this.items.push(causal);
  }

  listar(): Promise<CausalAveria[]> {
    return Promise.resolve(ordenarCausales(this.items));
  }

  buscarPorId(id: string): Promise<CausalAveria | null> {
    return Promise.resolve(this.items.find((c) => c.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<CausalAveria | null> {
    return Promise.resolve(this.items.find((c) => c.codigo === codigo) ?? null);
  }

  crear(datos: DatosCausal): Promise<CausalAveria> {
    const nueva = { ...datos, id: `causal-${++this.secuencia}`, activo: true };
    this.items.push(nueva);
    return Promise.resolve(nueva);
  }

  actualizar(id: string, cambios: Partial<DatosCausal> & { activo?: boolean }): Promise<CausalAveria> {
    const i = this.items.findIndex((c) => c.id === id);
    this.items[i] = { ...this.items[i], ...cambios };
    return Promise.resolve(this.items[i]);
  }
}
