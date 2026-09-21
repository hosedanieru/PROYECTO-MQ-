/**
 * CATÁLOGOS — Firestore
 * =====================
 *
 * `turnos`, `lugares`, `roles`: documentos con
 * codigo, nombre, activo. Los horarios de turno van EMBEBIDOS en el
 * documento del turno (`horarios: [...]`): siempre se leen juntos.
 */

import type {
  CatalogoRepository,
  ItemCatalogo,
} from '../../../domain/catalogo/catalogo.repository.js';
import type { HorarioRepository, HorarioTurno } from '../../../domain/mfr/horas-turno.js';
import { aDate, aDateONulo, COLECCION, type ClienteFirestore } from '../cliente-firestore.js';

export class CatalogoFirestoreRepository implements CatalogoRepository, HorarioRepository {
  constructor(private readonly cliente: ClienteFirestore) {}

  listarTurnos = () => this.listar(COLECCION.turnos);
  listarLugares = () => this.listar(COLECCION.lugares);
  listarRoles = () => this.listar(COLECCION.roles);

  private async listar(nombre: string): Promise<ItemCatalogo[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(nombre).orderBy('codigo'));
    return q.docs.map((d) => ({
      id: d.id,
      codigo: d.get('codigo'),
      nombre: d.get('nombre'),
      activo: d.get('activo') ?? true,
    }));
  }

  async vigentesEn(fechaOperativa: Date): Promise<HorarioTurno[]> {
    const q = await this.cliente.consultar(this.cliente.coleccion(COLECCION.turnos));
    const resultado: HorarioTurno[] = [];
    for (const turno of q.docs) {
      const horarios = (turno.get('horarios') ?? []) as Array<Record<string, unknown>>;
      for (const h of horarios) {
        const desde = aDate(h.vigenteDesde);
        const hasta = aDateONulo(h.vigenteHasta);
        if (desde <= fechaOperativa && (hasta === null || hasta >= fechaOperativa)) {
          resultado.push({
            turnoId: turno.id,
            diaSemana: h.diaSemana as HorarioTurno['diaSemana'],
            horaInicio: h.horaInicio as string,
            horaFin: h.horaFin as string,
            cruzaMedianoche: Boolean(h.cruzaMedianoche),
          });
        }
      }
    }
    return resultado;
  }
}
