/**
 * ENTIDAD USUARIO
 * ===============
 *
 * Persona de Inlotrans con cuenta en el sistema. Los actores de PepsiCo
 * (OPA, contacto de conciliación) NO son usuarios: se registran como
 * dato en cada remisión.
 *
 * Igual que `Remision`, esta clase solo importa TypeScript. Nada de
 * NestJS, Prisma ni bcrypt: el hash de la contraseña llega ya calculado
 * y se verifica a través de un puerto (`HashContrasena`).
 *
 * Lo que el dominio necesita saber de un usuario:
 *  - Quién es (documento, nombre).
 *  - Si puede entrar (activo).
 *  - Qué puede hacer (permisos, que vienen de su rol).
 */

import { DatosUsuarioInvalidosError } from './usuario.errors.js';

// ============================================================
// TIPOS DEL DOMINIO
// ============================================================

/** Datos necesarios para registrar un usuario nuevo. */
export interface DatosNuevoUsuario {
  documento: string;
  nombre: string;
  email?: string | null;
  /** Hash ya calculado por la infraestructura. Nunca la contraseña en claro. */
  passwordHash: string;
  rolId: string;
}

/** Estado completo de un usuario existente, tal como se persiste. */
export interface EstadoPersistidoUsuario extends DatosNuevoUsuario {
  id: string;
  activo: boolean;
  rolCodigo: string;
  /** Códigos de permiso resueltos desde el rol, p. ej. `remision.crear`. */
  permisos: string[];
}

/**
 * Vista pública del usuario: lo que se devuelve por HTTP y lo que viaja
 * en el token. Sin `passwordHash`, a propósito.
 */
export interface PerfilUsuario {
  id: string;
  documento: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  rolId: string;
  rolCodigo: string;
  permisos: string[];
}

// ============================================================
// ENTIDAD
// ============================================================

export class Usuario {
  private constructor(private readonly estadoInterno: EstadoPersistidoUsuario) {}

  // ---------- Construcción ----------

  /**
   * Crea un usuario nuevo, activo. El rol y sus permisos los resuelve la
   * infraestructura al persistir; aquí solo se conoce el `rolId`.
   */
  static crear(datos: DatosNuevoUsuario): Usuario {
    Usuario.validarDatos(datos);

    return new Usuario({
      ...datos,
      id: '',
      activo: true,
      documento: datos.documento.trim(),
      nombre: datos.nombre.trim(),
      email: datos.email?.trim().toLowerCase() || null,
      rolCodigo: '',
      permisos: [],
    });
  }

  /** Reconstruye un usuario desde la base de datos, sin revalidar. */
  static desdePersistencia(estado: EstadoPersistidoUsuario): Usuario {
    return new Usuario({ ...estado, permisos: [...estado.permisos] });
  }

  // ---------- Validaciones ----------

  private static validarDatos(datos: DatosNuevoUsuario): void {
    const exigir = (condicion: boolean, mensaje: string): void => {
      if (!condicion) {
        throw new DatosUsuarioInvalidosError(mensaje);
      }
    };

    const documento = datos.documento?.trim() ?? '';
    exigir(documento.length > 0, 'El documento es obligatorio.');
    exigir(
      /^[A-Za-z0-9-]{4,20}$/.test(documento),
      'El documento debe tener entre 4 y 20 caracteres alfanuméricos.',
    );

    exigir((datos.nombre?.trim() ?? '').length > 0, 'El nombre es obligatorio.');

    const email = datos.email?.trim();
    if (email) {
      exigir(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'El correo no es válido.');
    }

    exigir(
      (datos.passwordHash ?? '').length > 0,
      'El hash de la contraseña es obligatorio.',
    );
    exigir((datos.rolId ?? '').length > 0, 'El rol es obligatorio.');
  }

  // ---------- Consultas ----------

  get id(): string {
    return this.estadoInterno.id;
  }

  get documento(): string {
    return this.estadoInterno.documento;
  }

  get nombre(): string {
    return this.estadoInterno.nombre;
  }

  get activo(): boolean {
    return this.estadoInterno.activo;
  }

  get rolCodigo(): string {
    return this.estadoInterno.rolCodigo;
  }

  /** Solo para verificar credenciales. No debe salir de la aplicación. */
  get passwordHash(): string {
    return this.estadoInterno.passwordHash;
  }

  tienePermiso(codigo: string): boolean {
    return this.estadoInterno.permisos.includes(codigo);
  }

  /** Estado sin el hash, apto para devolver por HTTP o meter en el token. */
  aPerfil(): PerfilUsuario {
    const { passwordHash: _omitido, ...publico } = this.estadoInterno;
    return {
      ...publico,
      email: publico.email ?? null,
      permisos: [...publico.permisos],
    };
  }

  /** Estado completo para persistir. Uso exclusivo del repositorio. */
  aObjeto(): EstadoPersistidoUsuario {
    return { ...this.estadoInterno, permisos: [...this.estadoInterno.permisos] };
  }
}
