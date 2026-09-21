/**
 * DOBLES DE PRUEBA COMPARTIDOS
 * ============================
 *
 * Implementaciones en memoria de los puertos del dominio, para probar
 * los casos de uso sin PostgreSQL, sin Prisma y sin NestJS.
 *
 * Solo se importan desde archivos `*.spec.ts`. Los dobles específicos de
 * un módulo (p. ej. `RemisionRepositorioFalso`) viven junto a su spec;
 * aquí van los transversales.
 */

import type {
  AuditoriaRepository,
  EntradaAuditoria,
} from '../../domain/auditoria/auditoria.repository.js';
import type {
  DatosNuevoProducto,
  DatosProducto,
  FiltroProductos,
  Producto,
  ProductoRepository,
} from '../../domain/producto/producto.repository.js';
import { Remision, type EstadoRemision } from '../../domain/remision/remision.entity.js';
import type {
  CajasAgrupadas,
  RemisionRepository,
  ResultadoPaginado,
} from '../../domain/remision/remision.repository.js';
import type {
  ContextoTransaccional,
  UnidadDeTrabajo,
} from '../../domain/shared/unidad-de-trabajo.js';
import type { HashContrasena } from '../../domain/usuario/contrasena.js';
import type {
  ContenidoToken,
  EmisorDeToken,
} from '../../domain/usuario/emisor-token.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import type { UsuarioRepository } from '../../domain/usuario/usuario.repository.js';
import {
  AsignacionRepositorioFalso,
  AsistenciaRepositorioFalso,
  BloqueRepositorioFalso,
  EstandarRepositorioFalso,
  GrupoRepositorioFalso,
  LineaRepositorioFalso,
} from './dobles-mfr.js';

export class AuditoriaRepositorioFalso implements AuditoriaRepository {
  readonly entradas: EntradaAuditoria[] = [];

  registrar(entrada: EntradaAuditoria): Promise<void> {
    this.entradas.push(entrada);
    return Promise.resolve();
  }
}

export class UsuarioRepositorioFalso implements UsuarioRepository {
  readonly guardados: Usuario[] = [];
  private secuencia = 0;

  /** Permisos que se asignan al crear, simulando la resolución del rol. */
  permisosPorRol = new Map<string, { codigo: string; permisos: string[] }>();

  agregar(usuario: Usuario): void {
    this.guardados.push(usuario);
  }

  buscarPorId(id: string): Promise<Usuario | null> {
    return Promise.resolve(this.guardados.find((u) => u.id === id) ?? null);
  }

  buscarPorDocumento(documento: string): Promise<Usuario | null> {
    return Promise.resolve(
      this.guardados.find((u) => u.documento === documento) ?? null,
    );
  }

  listar(): Promise<Usuario[]> {
    return Promise.resolve([...this.guardados]);
  }

  crear(usuario: Usuario): Promise<Usuario> {
    const persistido = this.conRol(usuario, `usuario-${++this.secuencia}`);
    this.guardados.push(persistido);
    return Promise.resolve(persistido);
  }

  actualizar(usuario: Usuario): Promise<Usuario> {
    const indice = this.guardados.findIndex((u) => u.id === usuario.id);
    const persistido = this.conRol(usuario, usuario.id);
    if (indice >= 0) {
      this.guardados[indice] = persistido;
    }
    return Promise.resolve(persistido);
  }

  /** Simula la resolución del rol (código y permisos) que hace la base. */
  private conRol(usuario: Usuario, id: string): Usuario {
    const estado = usuario.aObjeto();
    const rol = this.permisosPorRol.get(estado.rolId);
    return Usuario.desdePersistencia({
      ...estado,
      id,
      rolCodigo: rol?.codigo ?? '',
      permisos: rol?.permisos ?? [],
    });
  }
}

export class ProductoRepositorioFalso implements ProductoRepository {
  readonly items: Producto[] = [];
  private secuencia = 0;

  agregar(producto: Producto): void {
    this.items.push(producto);
  }

  buscarPorId(id: string): Promise<Producto | null> {
    return Promise.resolve(this.items.find((p) => p.id === id) ?? null);
  }

  buscarPorCodigo(codigo: string): Promise<Producto | null> {
    return Promise.resolve(this.items.find((p) => p.codigo === codigo) ?? null);
  }

  listar(filtro: FiltroProductos): Promise<Producto[]> {
    const texto = filtro.texto?.toLowerCase();
    return Promise.resolve(
      this.items.filter(
        (p) =>
          (!filtro.soloActivos || p.activo) &&
          (!texto ||
            p.codigo.toLowerCase().includes(texto) ||
            p.descripcion.toLowerCase().includes(texto)),
      ),
    );
  }

  crear(datos: DatosNuevoProducto): Promise<Producto> {
    const creado: Producto = {
      ...datos,
      id: `prod-${++this.secuencia}`,
      activo: true,
      cajasPorHora: datos.cajasPorHora ?? null,
      pesoNetoKg: datos.pesoNetoKg ?? null,
    };
    this.items.push(creado);
    return Promise.resolve(creado);
  }

  actualizar(
    id: string,
    cambios: Partial<DatosProducto> & { activo?: boolean },
  ): Promise<Producto> {
    const indice = this.items.findIndex((p) => p.id === id);
    const actualizado = { ...this.items[indice], ...cambios };
    this.items[indice] = actualizado;
    return Promise.resolve(actualizado);
  }
}

/**
 * Hash reversible y legible, SOLO para pruebas. Permite comprobar en las
 * aserciones que la contraseña en claro nunca se guardó.
 */
export class HashFalso implements HashContrasena {
  hashear(contrasena: string): Promise<string> {
    return Promise.resolve(`hash(${contrasena})`);
  }

  verificar(contrasena: string, hash: string): Promise<boolean> {
    return Promise.resolve(hash === `hash(${contrasena})`);
  }
}

export class EmisorTokenFalso implements EmisorDeToken {
  readonly emitidos: ContenidoToken[] = [];

  emitir(contenido: ContenidoToken): Promise<string> {
    this.emitidos.push(contenido);
    return Promise.resolve(`token-${contenido.usuarioId}`);
  }

  verificar(token: string): Promise<ContenidoToken | null> {
    const encontrado = this.emitidos.find(
      (c) => `token-${c.usuarioId}` === token,
    );
    return Promise.resolve(encontrado ?? null);
  }
}

/**
 * Unidad de trabajo sin transacción real: simplemente entrega los
 * repositorios en memoria. Sirve para verificar la coordinación del
 * caso de uso; la atomicidad la garantiza la implementación de Prisma.
 */
export class UnidadDeTrabajoFalsa implements UnidadDeTrabajo {
  readonly contexto: ContextoTransaccional;

  /** Los repositorios que no se pasen se reemplazan por dobles vacíos. */
  constructor(parcial: Partial<ContextoTransaccional> = {}) {
    this.contexto = {
      remisiones: REMISIONES_SIN_USO,
      usuarios: new UsuarioRepositorioFalso(),
      productos: new ProductoRepositorioFalso(),
      grupos: new GrupoRepositorioFalso(),
      auditoria: new AuditoriaRepositorioFalso(),
      bloques: new BloqueRepositorioFalso(),
      lineas: new LineaRepositorioFalso(),
      estandares: new EstandarRepositorioFalso(),
      asistencias: new AsistenciaRepositorioFalso(),
      asignaciones: new AsignacionRepositorioFalso(),
      ...parcial,
    };
  }

  ejecutar<T>(
    trabajo: (contexto: ContextoTransaccional) => Promise<T>,
  ): Promise<T> {
    return trabajo(this.contexto);
  }
}

/**
 * Repositorio de remisiones que no hace nada. Para los casos de uso que
 * no tocan remisiones pero necesitan un contexto transaccional completo.
 */
export const REMISIONES_SIN_USO: RemisionRepository = {
  crearConConsecutivo: () => Promise.reject(new Error('No aplica')),
  actualizar: () => Promise.reject(new Error('No aplica')),
  registrarVersion: () => Promise.reject(new Error('No aplica')),
  buscarPorId: () => Promise.resolve(null),
  buscarPorConsecutivo: () => Promise.resolve(null),
  listar: () => Promise.reject(new Error('No aplica')),
  listarTodas: () => Promise.resolve([]),
  buscarPorIds: () => Promise.resolve([]),
  totalizarCajas: () => Promise.resolve([]),
};

/**
 * Repositorio de remisiones en memoria, por id. Devuelve copias (como la
 * base) y totaliza cajas por turno, producto y extraoficial, igual que
 * las implementaciones reales. Para los casos de uso del flujo.
 */
export class RemisionRepositorioEnMemoria implements RemisionRepository {
  readonly porId = new Map<string, Remision>();
  private secuencia = 0;

  agregar(id: string, remision: Remision): Remision {
    const guardada = Remision.desdePersistencia({ ...remision.aObjeto(), id });
    this.porId.set(id, guardada);
    return guardada;
  }

  crearConConsecutivo(construir: (anio: number, numero: number) => Remision, anio: number): Promise<Remision> {
    const remision = construir(anio, ++this.secuencia);
    return Promise.resolve(this.agregar(`rem-${this.secuencia}`, remision));
  }

  actualizar(remision: Remision): Promise<Remision> {
    this.porId.set(remision.id, Remision.desdePersistencia(remision.aObjeto()));
    return Promise.resolve(remision);
  }

  registrarVersion(): Promise<void> {
    return Promise.resolve();
  }

  buscarPorId(id: string): Promise<Remision | null> {
    const r = this.porId.get(id);
    return Promise.resolve(r ? Remision.desdePersistencia(r.aObjeto()) : null);
  }

  buscarPorConsecutivo(): Promise<Remision | null> {
    return Promise.resolve(null);
  }

  listar(): Promise<ResultadoPaginado<Remision>> {
    const items = [...this.porId.values()];
    return Promise.resolve({ items, total: items.length, pagina: 1, porPagina: items.length });
  }

  listarTodas(): Promise<Remision[]> {
    return Promise.resolve([...this.porId.values()]);
  }

  buscarPorIds(ids: string[]): Promise<Remision[]> {
    return Promise.resolve(ids.map((id) => this.porId.get(id)).filter((r): r is Remision => !!r));
  }

  totalizarCajas(fechaOperativa: Date, estados: readonly EstadoRemision[]): Promise<CajasAgrupadas[]> {
    const grupos = new Map<string, CajasAgrupadas>();
    for (const r of this.porId.values()) {
      const d = r.aObjeto();
      if (d.fechaOperativa.getTime() !== fechaOperativa.getTime() || !estados.includes(d.estado)) continue;
      const clave = `${d.turnoId}|${d.productoId}|${d.extraoficial}`;
      const g = grupos.get(clave) ?? { turnoId: d.turnoId, productoId: d.productoId, extraoficial: d.extraoficial, cajas: 0 };
      g.cajas += d.cantidadCajas;
      grupos.set(clave, g);
    }
    return Promise.resolve([...grupos.values()]);
  }
}
