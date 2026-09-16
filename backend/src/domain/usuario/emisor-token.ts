/**
 * EMISOR DE TOKEN — Puerto
 * ========================
 *
 * El caso de uso de inicio de sesión necesita "algo" que convierta la
 * identidad del usuario en una credencial portable. Que sea un JWT
 * firmado con HS256 es un detalle de infraestructura.
 *
 * El contenido del token (`ContenidoToken`) es deliberadamente mínimo:
 * lo justo para identificar al usuario en cada petición. Los permisos
 * NO viajan en el token; se consultan en la base de datos al validar,
 * para que un cambio de rol aplique de inmediato y no cuando el token
 * expire (12 horas después).
 */

export interface ContenidoToken {
  /** `sub` en la jerga JWT: el id del usuario. */
  usuarioId: string;
  documento: string;
}

export interface EmisorDeToken {
  emitir(contenido: ContenidoToken): Promise<string>;
  /** Devuelve el contenido si el token es válido y vigente; si no, `null`. */
  verificar(token: string): Promise<ContenidoToken | null>;
}

export const EMISOR_DE_TOKEN = Symbol('EmisorDeToken');
