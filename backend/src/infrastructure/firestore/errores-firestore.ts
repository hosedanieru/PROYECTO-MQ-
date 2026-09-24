/**
 * ERRORES DE FIRESTORE QUE NO SON CULPA DE NADIE
 * ==============================================
 *
 * Firestore puede negarse a responder por motivos que no tienen que ver
 * con los datos ni con las reglas del negocio: se agotó la cuota diaria,
 * la red se cayó, el servicio no está disponible. Sin traducir, todo eso
 * llega al usuario como "Internal server error", que no dice nada y
 * hace perder horas buscando un fallo en el código que no existe.
 *
 * Aquí se convierten en un error con nombre y mensaje claro. El filtro
 * HTTP lo responde como 503 (servicio no disponible), que es la verdad:
 * la petición estaba bien, el almacén no pudo atenderla.
 *
 * Los códigos son los de gRPC:
 *   8  RESOURCE_EXHAUSTED  cuota agotada
 *   14 UNAVAILABLE         sin conexión con el servicio
 *   4  DEADLINE_EXCEEDED   tardó más de lo permitido
 */

/** Códigos gRPC que significan "vuelve a intentar", no "lo hiciste mal". */
const CODIGOS = new Map<number, string>([
  [
    8,
    'Se agotó la cuota de Firestore. El plan gratuito tiene un tope de lecturas por día ' +
      'que se reinicia a medianoche (hora del Pacífico, ~02:00 en Colombia). ' +
      'Mientras tanto la base no responde a nadie.',
  ],
  [14, 'Firestore no está disponible en este momento (sin conexión con el servicio).'],
  [4, 'Firestore tardó demasiado en responder.'],
]);

export class ErrorPersistencia extends Error {
  readonly codigo: string;

  constructor(
    mensaje: string,
    /** Código gRPC original, para el log. */
    readonly codigoOriginal: number | undefined,
    causa: unknown,
  ) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorPersistencia';
    this.codigo = codigoOriginal === 8 ? 'PERSISTENCIA_CUOTA_AGOTADA' : 'PERSISTENCIA_NO_DISPONIBLE';
  }
}

/**
 * Traduce si corresponde; si no, devuelve el error tal cual.
 *
 * Solo se traducen los códigos de la tabla: un error de permisos o de
 * datos mal formados debe seguir viéndose como lo que es, no disfrazado
 * de "servicio no disponible".
 */
export function traducirErrorFirestore(error: unknown): unknown {
  if (error instanceof ErrorPersistencia) return error;

  const codigo = (error as { code?: unknown } | null)?.code;
  if (typeof codigo !== 'number') return error;

  const mensaje = CODIGOS.get(codigo);
  return mensaje === undefined ? error : new ErrorPersistencia(mensaje, codigo, error);
}
