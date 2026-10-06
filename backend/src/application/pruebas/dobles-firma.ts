import type {
  CalculadorHuella,
  FirmaRemision,
  FirmaRemisionRepository,
  NuevaFirma,
} from '../../domain/remision/firma-remision.js';
import { FirmaYaRegistradaError } from '../../domain/remision/firma-remision.js';

/** Firmas en memoria, con la misma unicidad (remisión, versión, tipo) que la base. */
export class FirmaRemisionRepositorioFalso implements FirmaRemisionRepository {
  readonly firmas: FirmaRemision[] = [];

  listarPorRemision(remisionId: string): Promise<FirmaRemision[]> {
    return Promise.resolve(this.firmas.filter((f) => f.remisionId === remisionId));
  }

  crear(firma: NuevaFirma): Promise<FirmaRemision> {
    if (this.firmas.some((f) => f.remisionId === firma.remisionId && f.version === firma.version && f.tipo === firma.tipo)) {
      return Promise.reject(new FirmaYaRegistradaError(firma.tipo, firma.version));
    }
    const creada = { ...firma, id: `firma-${this.firmas.length + 1}` };
    this.firmas.push(creada);
    return Promise.resolve(creada);
  }
}

/** Huella legible para las pruebas: cambia si cambia el contenido, igual que SHA-256. */
export class CalculadorHuellaFalso implements CalculadorHuella {
  sha256(texto: string): string {
    let h = 0;
    for (const c of texto) h = (h * 31 + c.charCodeAt(0)) | 0;
    return `huella-${(h >>> 0).toString(16)}`;
  }
}
