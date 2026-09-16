/**
 * ERROR DE DOMINIO — Base compartida
 * ==================================
 *
 * Todos los errores de negocio de la aplicación heredan de aquí, sin
 * importar el módulo (remisiones, usuarios, y los que vengan). Eso
 * permite que un solo filtro HTTP los reconozca y los traduzca.
 *
 * Un error de dominio describe QUÉ REGLA se violó. No sabe nada de HTTP,
 * de códigos de estado ni de Prisma. La capa de presentación decide si
 * un `codigo` dado es un 400, un 401 o un 409.
 */
export abstract class ErrorDominio extends Error {
  /** Identificador legible y estable, p. ej. `REMISION_NO_ENCONTRADA`. */
  abstract readonly codigo: string;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}
