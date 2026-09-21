/**
 * EXPORTADOR A EXCEL — Implementación con exceljs
 * ===============================================
 *
 * Una hoja "Remisiones" con encabezado fijo, filtros automáticos y
 * anchos legibles. Las fechas van como fechas reales (no texto) para
 * que Excel pueda filtrar y agrupar por ellas.
 */

import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import type { ExportadorExcelRemision } from '../../domain/remision/exportador-excel.js';
import type { RemisionParaImprimir } from '../../domain/remision/generador-pdf.js';

const COLUMNAS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Consecutivo', key: 'consecutivo', width: 12 },
  { header: 'Versión', key: 'version', width: 8 },
  { header: 'Estado', key: 'estado', width: 16 },
  { header: 'Fecha operativa', key: 'fechaOperativa', width: 14 },
  { header: 'Hora registro', key: 'fechaHoraRegistro', width: 18 },
  { header: 'Turno', key: 'turno', width: 8 },
  { header: 'Grupo', key: 'grupo', width: 16 },
  { header: 'Lugar', key: 'lugar', width: 30 },
  { header: 'Ítem', key: 'codigo', width: 12 },
  { header: 'Descripción', key: 'descripcion', width: 40 },
  { header: 'F. vencimiento', key: 'fechaVencimiento', width: 14 },
  { header: 'Cajas', key: 'cantidadCajas', width: 8 },
  { header: 'Unidades', key: 'cantidadUnidades', width: 10 },
  { header: 'Estibas completas', key: 'estibasCompletas', width: 10 },
  { header: 'Cajas sueltas', key: 'cajasSueltas', width: 10 },
  { header: 'N° estibas', key: 'numerosEstiba', width: 16 },
  { header: 'Observaciones', key: 'observaciones', width: 30 },
  { header: 'Extraoficial', key: 'extraoficial', width: 11 },
  { header: 'Motivo extraoficial', key: 'motivoExtraoficial', width: 28 },
  { header: 'OPA', key: 'opaNombre', width: 18 },
  { header: 'Cargo OPA', key: 'opaCargo', width: 14 },
  { header: 'F. aprobación', key: 'fechaAprobacion', width: 18 },
  { header: 'Conciliado con', key: 'conciliadoCon', width: 18 },
  { header: 'F. validación', key: 'fechaValidacion', width: 18 },
];

/**
 * Excel no maneja zonas horarias: exceljs escribe el instante en UTC.
 * Para que la hoja muestre la hora de Colombia (UTC−5, sin horario de
 * verano) se desplaza el instante 5 horas. Las fechas de solo día ya
 * están a medianoche UTC y se escriben tal cual.
 */
const DESPLAZAMIENTO_BOGOTA_MS = -5 * 60 * 60 * 1000;

function enHoraBogota(instante: Date | null | undefined): Date | null {
  return instante ? new Date(instante.getTime() + DESPLAZAMIENTO_BOGOTA_MS) : null;
}

@Injectable()
export class ExceljsExportadorService implements ExportadorExcelRemision {
  async generar(remisiones: RemisionParaImprimir[]): Promise<Buffer> {
    const libro = new ExcelJS.Workbook();
    libro.creator = 'Aplicativo MQ — Inlotrans';
    libro.created = new Date();

    const hoja = libro.addWorksheet('Remisiones', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    hoja.columns = COLUMNAS;
    hoja.getRow(1).font = { bold: true };
    hoja.autoFilter = { from: 'A1', to: `${columnaLetra(COLUMNAS.length)}1` };

    for (const { remision, turno, grupo, lugar } of remisiones) {
      const d = remision.aObjeto();
      hoja.addRow({
        consecutivo: remision.consecutivo,
        version: d.version,
        estado: d.estado,
        fechaOperativa: d.fechaOperativa,
        fechaHoraRegistro: enHoraBogota(d.fechaHoraRegistro),
        turno,
        grupo,
        lugar,
        codigo: d.codigoSnapshot,
        descripcion: d.descripcionSnapshot,
        fechaVencimiento: d.fechaVencimiento,
        cantidadCajas: d.cantidadCajas,
        cantidadUnidades: d.cantidadUnidades,
        estibasCompletas: d.estibasCompletas,
        cajasSueltas: d.cajasSueltas,
        numerosEstiba: d.numerosEstiba.join(', '),
        observaciones: d.observaciones ?? '',
        extraoficial: d.extraoficial ? 'SÍ' : '',
        motivoExtraoficial: d.motivoExtraoficial ?? '',
        opaNombre: d.opaNombre ?? '',
        opaCargo: d.opaCargo ?? '',
        fechaAprobacion: enHoraBogota(d.fechaAprobacion),
        conciliadoCon: d.conciliadoCon ?? '',
        fechaValidacion: enHoraBogota(d.fechaValidacion),
      });
    }

    for (const clave of ['fechaOperativa', 'fechaVencimiento']) {
      hoja.getColumn(clave).numFmt = 'dd/mm/yyyy';
    }
    for (const clave of ['fechaHoraRegistro', 'fechaAprobacion', 'fechaValidacion']) {
      hoja.getColumn(clave).numFmt = 'dd/mm/yyyy hh:mm';
    }

    return Buffer.from(await libro.xlsx.writeBuffer());
  }
}

/** 1 → A, 26 → Z, 27 → AA. */
function columnaLetra(n: number): string {
  let letra = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}
