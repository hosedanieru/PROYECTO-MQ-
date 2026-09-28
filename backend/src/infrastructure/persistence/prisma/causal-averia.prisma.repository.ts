/**
 * CAUSALES DE AVERÍA — Implementación con Prisma
 * ==============================================
 */

import type {
  CausalAveria,
  CausalAveriaRepository,
  DatosCausal,
} from '../../../domain/averia/causal-averia.js';
import type { ClientePrisma } from './cliente-prisma.js';

export class CausalAveriaPrismaRepository implements CausalAveriaRepository {
  constructor(private readonly cliente: ClientePrisma) {}

  listar(): Promise<CausalAveria[]> {
    return this.cliente.causalAveria.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
  }

  buscarPorId(id: string): Promise<CausalAveria | null> {
    return this.cliente.causalAveria.findUnique({ where: { id } });
  }

  buscarPorCodigo(codigo: string): Promise<CausalAveria | null> {
    return this.cliente.causalAveria.findUnique({ where: { codigo } });
  }

  crear(datos: DatosCausal): Promise<CausalAveria> {
    return this.cliente.causalAveria.create({ data: datos });
  }

  actualizar(id: string, cambios: Partial<DatosCausal> & { activo?: boolean }): Promise<CausalAveria> {
    return this.cliente.causalAveria.update({ where: { id }, data: cambios });
  }
}
