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
import type { RemisionRepository } from '../../domain/remision/remision.repository.js';
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

  crear(usuario: Usuario): Promise<Usuario> {
    const estado = usuario.aObjeto();
    const rol = this.permisosPorRol.get(estado.rolId);

    const persistido = Usuario.desdePersistencia({
      ...estado,
      id: `usuario-${++this.secuencia}`,
      rolCodigo: rol?.codigo ?? '',
      permisos: rol?.permisos ?? [],
    });
    this.guardados.push(persistido);

    return Promise.resolve(persistido);
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
  constructor(private readonly contexto: ContextoTransaccional) {}

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
};
