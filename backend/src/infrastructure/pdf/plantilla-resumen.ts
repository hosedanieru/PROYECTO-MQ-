/**
 * PLANTILLA HTML DEL RESUMEN DEL TURNO / DEL DÍA
 * ==============================================
 *
 * Decisión del usuario (2026-10-03): sin logo, solo los nombres. Lleva el
 * cuadro de control documental que pide el SIG (Sistema Integrado de
 * Gestión): código, versión y vigencia del formato. Mientras el SIG no lo
 * apruebe, el cuadro dice "PENDIENTE DE APROBACIÓN SIG".
 *
 *   INLOTRANS S.A.S.     RESUMEN DE TURNO          Código: …
 *   Maquila PepsiCo      RT-2026-0007              Versión: …
 *   Santo Domingo                                  Vigencia: …
 *
 * Secciones: Producción · Remisiones · Personal · Averías · Inventario ·
 * Novedades del coordinador. Hoja carta vertical.
 */

import { consecutivoResumen, type ResumenTurno } from '../../domain/resumen/resumen-turno.js';
import { escapar, fechaDia, fechaRegistro, horaRegistro } from './formato.js';

const TITULO = { TURNO: 'RESUMEN DE TURNO', DIA: 'RESUMEN DEL DÍA OPERATIVO' } as const;

const ESTADO_REMISION: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENTREGADA: 'Sin aprobar',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  EN_RECTIFICACION: 'En rectificación',
  VALIDADA: 'Validada',
};

const ESTADO_PERSONAL: Record<string, string> = { A_FIN: 'A fin', AFECTADA: 'Afectada', SIN_DATO: 'Sin dato' };
const SEMAFORO: Record<string, string> = { VERDE: 'Verde', AMARILLO: 'Amarillo', ROJO: 'Rojo' };

const numero = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(n);
const pct = (n: number | null) => (n === null ? '—' : `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)} %`);

function tabla(encabezados: string[], filas: string[][], vacio: string): string {
  if (filas.length === 0) return `<p class="vacio">${escapar(vacio)}</p>`;
  return `<table class="tabla">
    <thead><tr>${encabezados.map((e) => `<th>${escapar(e)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function dato(rotulo: string, valor: string): string {
  return `<div class="dato"><span>${escapar(rotulo)}</span><b>${valor}</b></div>`;
}

export function plantillaResumen(r: ResumenTurno): string {
  const d = r.datos;
  const p = d.produccion;
  const pendienteSig = !r.formato.codigo;

  const control = pendienteSig
    ? `<div class="pendiente">FORMATO PENDIENTE DE<br>APROBACIÓN SIG</div>`
    : `<div><b>Código:</b> ${escapar(r.formato.codigo)}</div>
       <div><b>Versión:</b> ${escapar(r.formato.version ?? '—')}</div>
       <div><b>Vigencia:</b> ${escapar(r.formato.vigencia ?? '—')}</div>`;

  const produccion = `
    <div class="datos">
      ${dato('Programado (DPP)', `${numero(p.programadoCajas)} cajas`)}
      ${dato('Aprobado por el OPA', `${numero(p.producidoCajas)} cajas`)}
      ${dato('Cumplimiento (MFR)', pct(p.cumplimiento))}
      ${dato('Semáforo', escapar(p.semaforo ? SEMAFORO[p.semaforo] ?? p.semaforo : '—'))}
      ${p.extraoficialesCajas > 0 ? dato('Extraoficiales (fuera del MFR)', `${numero(p.extraoficialesCajas)} cajas`) : ''}
    </div>
    ${tabla(
      ['Código', 'Producto', 'Programado', 'Aprobado', 'Cumplimiento'],
      p.porProducto.map((x) => [escapar(x.codigo), escapar(x.descripcion), numero(x.programadoCajas), numero(x.producidoCajas), pct(x.cumplimiento)]),
      'Sin programación en el periodo.',
    )}
    ${p.porLinea.length > 0 ? `<p class="nota"><b>Programado por línea:</b> ${p.porLinea.map((l) => `${escapar(l.codigo)} ${numero(l.programadoCajas)}`).join(' · ')}</p>` : ''}
    ${
      p.faltantes.length > 0
        ? `<p class="nota alerta"><b>Faltantes al cierre:</b> ${p.faltantes.map((f) => `${escapar(f.codigo)} (${numero(f.producidoCajas)} de ${numero(f.programadoCajas)})`).join(' · ')}
           ${p.motivoFaltante ? `<br><b>Motivo:</b> ${escapar(p.motivoFaltante)}` : ''}</p>`
        : ''
    }`;

  const estados = Object.entries(d.remisiones.porEstado).filter(([, n]) => n > 0);
  const remisiones = `
    <p class="nota">${estados.length > 0 ? estados.map(([e, n]) => `<b>${escapar(ESTADO_REMISION[e] ?? e)}:</b> ${n}`).join(' · ') : 'Sin remisiones en el periodo.'}</p>
    ${tabla(
      ['Remisión', 'Código', 'Producto', 'Cajas', 'Estado'],
      d.remisiones.lista.map((x) => [
        escapar(x.consecutivo),
        escapar(x.codigo),
        escapar(x.descripcion),
        numero(x.cajas),
        `${escapar(ESTADO_REMISION[x.estado] ?? x.estado)}${x.extraoficial ? ' · extraoficial' : ''}${x.motivoRechazo && x.estado === 'RECHAZADA' ? `<br><small>${escapar(x.motivoRechazo)}</small>` : ''}`,
      ]),
      '',
    )}`;

  const per = d.personal;
  const personal = `
    <div class="datos">
      ${dato('Requeridas por el DPP', numero(per.requeridasDpp))}
      ${dato('Llegaron', numero(per.llegaron))}
      ${dato('Cobertura', pct(per.coberturaDpp))}
      ${dato('Estado', escapar(ESTADO_PERSONAL[per.estado] ?? per.estado))}
    </div>
    ${per.grupos.length > 0 ? tabla(
      ['Grupo', 'Esperadas', 'Llegaron', 'Estado'],
      per.grupos.map((g) => [escapar(g.nombre), g.esperadas === null ? '—' : numero(g.esperadas), numero(g.llegaron), escapar(ESTADO_PERSONAL[g.estado] ?? g.estado)]),
      '',
    ) : ''}`;

  const av = d.averias;
  const averias = `
    <div class="datos">
      ${dato('Unidades averiadas', numero(av.unidades))}
      ${dato('% contra el DPP', pct(av.porcentaje))}
      ${dato('Máximo por contrato', pct(av.maximoPorcentaje))}
      ${av.excede ? dato('Resultado', '<span class="rojo">EXCEDE EL MÁXIMO</span>') : ''}
    </div>
    ${av.porCausal.length > 0 ? `<p class="nota"><b>Por causal:</b> ${av.porCausal.map((c) => `${escapar(c.causal)} ${numero(c.unidades)}`).join(' · ')}</p>` : ''}`;

  const inv = d.inventario;
  const inventario = `
    ${tabla(
      ['Código', 'Material', 'Consumido por recetas'],
      inv.consumo.map((c) => [escapar(c.codigo), escapar(c.descripcion), `${numero(c.cantidad)} ${escapar(c.unidad)}`]),
      'Sin consumo registrado (no se aprobaron remisiones con receta).',
    )}
    ${inv.alertas.length > 0 ? `<p class="nota alerta"><b>Alertas críticas abiertas:</b><br>${inv.alertas.map((a) => escapar(a.mensaje)).join('<br>')}</p>` : ''}`;

  const novedades = d.novedades
    .map((n) => `<div class="novedad">${d.novedades.length > 1 || r.tipo === 'DIA' ? `<b>${escapar(n.turno)}</b><br>` : ''}${escapar(n.texto).replace(/\n/g, '<br>')}</div>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${escapar(consecutivoResumen(r.tipo, r.anio, r.numero))}</title>
<style>
  @page { size: letter portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9pt; }
  table { width: 100%; border-collapse: collapse; }
  .cabecera td { border: 1px solid #000; padding: 2mm; vertical-align: middle; }
  .empresa { width: 28%; font-size: 9pt; line-height: 1.35; }
  .empresa b { font-size: 11pt; }
  .titulo { text-align: center; }
  .titulo .nombre { font-size: 14pt; font-weight: bold; }
  .titulo .consecutivo { font-size: 12pt; margin-top: 1mm; letter-spacing: 1px; }
  .control { width: 26%; font-size: 8pt; line-height: 1.5; }
  .pendiente { text-align: center; font-weight: bold; color: #a00; font-size: 8pt; }
  .encabezado { margin-top: 2mm; }
  .encabezado td { border: 1px solid #000; padding: 1.2mm 2mm; font-size: 8.5pt; }
  .encabezado td.r { background: #eef0f6; font-weight: bold; width: 16%; }
  h2 { font-size: 10pt; margin: 4mm 0 1.5mm; padding: 1mm 2mm; background: #1a237e; color: #fff; break-after: avoid; }
  .datos { display: flex; flex-wrap: wrap; gap: 1.5mm 6mm; margin-bottom: 1.5mm; }
  .dato span { color: #555; margin-right: 1.5mm; }
  .tabla th { background: #eef0f6; border: 1px solid #999; padding: 1mm; font-size: 8pt; text-align: left; }
  .tabla td { border: 1px solid #bbb; padding: 0.8mm 1mm; font-size: 8pt; }
  .tabla tr { break-inside: avoid; }
  .nota { margin: 1.5mm 0; line-height: 1.4; }
  .alerta { border-left: 2px solid #c00; padding-left: 2mm; }
  .rojo { color: #c00; }
  .vacio { color: #666; font-style: italic; margin: 1mm 0; }
  .novedad { border: 1px solid #bbb; padding: 2mm; margin-bottom: 1.5mm; line-height: 1.45; white-space: normal; break-inside: avoid; }
  .pie { margin-top: 4mm; font-size: 7pt; color: #666; text-align: center; }
</style>
</head>
<body>
  <table class="cabecera">
    <tr>
      <td class="empresa"><b>INLOTRANS S.A.S.</b><br>Área de Maquila (MQ)<br>Maquila PepsiCo Santo Domingo</td>
      <td class="titulo">
        <div class="nombre">${TITULO[r.tipo]}</div>
        <div class="consecutivo">${escapar(consecutivoResumen(r.tipo, r.anio, r.numero))}</div>
      </td>
      <td class="control">${control}</td>
    </tr>
  </table>

  <table class="encabezado">
    <tr>
      <td class="r">Día operativo</td><td>${fechaDia(r.fechaOperativa)}</td>
      <td class="r">${r.tipo === 'TURNO' ? 'Turno' : 'Periodo'}</td><td>${escapar(d.titulo)}${d.horario ? ` (${escapar(d.horario)})` : ''}</td>
    </tr>
    <tr>
      <td class="r">Cerrado por</td><td>${escapar(r.cerradoPorNombre)}</td>
      <td class="r">Fecha y hora</td><td>${fechaRegistro(r.fechaHora)} ${horaRegistro(r.fechaHora)}</td>
    </tr>
  </table>

  <h2>1. Producción contra el DPP</h2>
  ${produccion}

  <h2>2. Remisiones</h2>
  ${remisiones}

  <h2>3. Personal</h2>
  ${personal}

  <h2>4. Averías</h2>
  ${averias}

  <h2>5. Inventario</h2>
  ${inventario}

  <h2>6. Novedades del coordinador</h2>
  ${novedades || '<p class="vacio">Sin novedades.</p>'}

  <div class="pie">Foto tomada al cerrar el turno: las cifras no cambian aunque después se aprueben o corrijan remisiones. Generado por el aplicativo MQ.</div>
</body>
</html>`;
}
