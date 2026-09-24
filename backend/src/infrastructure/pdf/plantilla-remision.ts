/**
 * PLANTILLA HTML DE LA REMISIÓN — formato aprobado por Inlotrans
 * ==============================================================
 *
 * Reproduce el formato oficial (hoja vertical, dos remisiones por hoja):
 *
 *   [logo]        REMISIÓN                     [ ]
 *   FECHA: dd/mm/aaaa          LUGAR: MAQUILA PEPSICO SANTO DOMINGO
 *   No.DE REMISIÓN  J3-10046   HORA   7:25
 *   TURNO | ITEM | DESCRIPCION | FECHAS DE VENCIMIENTO | CANT CAJAS | CANT UNIDADES | Nº ESTIBAS | OBSERVACIONES
 *   FIRMA QUIEN RECIBE   FIRMA INLOTRANS
 *   FIRMA VERIFICADOR
 *
 * Celdas verdes = las que el coordinador diligencia en el formato
 * original; encabezado de tabla azul marino con texto blanco.
 *
 * Datos:
 *   FECHA / HORA  → fecha y hora de REGISTRO (hora de Bogotá)
 *   TURNO         → "TURNO 2" + fecha OPERATIVA en dd/mm/aa
 *   Nº ESTIBAS    → "estibasCompletas,cajasSueltas" (PENDIENTE DE CONFIRMAR)
 *   OBSERVACIONES → observaciones + "EST: 7,8,9,10"
 *
 * Si la remisión no está aprobada lleva una marca de agua con su estado,
 * y si es una versión rectificada se indica: ambas cosas fuera del
 * cuadro, para no alterar el formato aprobado.
 *
 * El logo se lee de `backend/recursos/logo-inlotrans.png` y se embebe en
 * base64; si no existe, se muestra "INLOTRANS" en texto.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { RemisionParaImprimir } from '../../domain/remision/generador-pdf.js';

const ZONA = 'America/Bogota';
const RUTA_LOGO = path.resolve(process.cwd(), 'recursos', 'logo-inlotrans.png');

let logoCache: string | null | undefined;

/** Data URI del logo, o null si no está el archivo. Se lee una sola vez. */
function logo(): string | null {
  if (logoCache === undefined) {
    logoCache = existsSync(RUTA_LOGO)
      ? `data:image/png;base64,${readFileSync(RUTA_LOGO).toString('base64')}`
      : null;
  }
  return logoCache;
}

function escapar(texto: string | null | undefined): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fechas de solo día (operativa, vencimiento): en UTC, no retroceden. */
function fechaDia(d: Date, anioCorto = false): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: anioCorto ? '2-digit' : 'numeric',
  }).format(d);
}

/** Instantes reales: en hora de Colombia. */
function fechaRegistro(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

function horaRegistro(d: Date): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: false }).format(d);
}

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: 'BORRADOR',
  ENTREGADA: 'SIN APROBAR',
  RECHAZADA: 'RECHAZADA',
  EN_RECTIFICACION: 'EN RECTIFICACIÓN',
};

function bloqueRemision({ remision, turno, lugar }: RemisionParaImprimir): string {
  const d = remision.aObjeto();
  const marca = ETIQUETA_ESTADO[d.estado];
  const observaciones = [d.observaciones, d.numerosEstiba.length ? `EST: ${d.numerosEstiba.join(',')}` : null]
    .filter(Boolean)
    .join(' · ');
  const imagen = logo();

  return `
  <section class="remision">
    ${marca ? `<div class="marca">${escapar(marca)}</div>` : ''}

    <table class="cabecera">
      <tr>
        <td class="logo">${imagen ? `<img src="${imagen}" alt="Inlotrans">` : '<span class="logo-texto">INLOTRANS</span>'}</td>
        <td class="titulo">REMISIÓN</td>
        <td class="caja-derecha">${d.version > 1 ? `<span class="version">Versión ${d.version} — rectificada</span>` : ''}</td>
      </tr>
    </table>

    <table class="datos">
      <tr>
        <td class="rotulo">FECHA:</td>
        <td class="valor">${fechaRegistro(d.fechaHoraRegistro)}</td>
        <td class="rotulo">LUGAR:</td>
        <td class="valor">${escapar(lugar)}</td>
      </tr>
      <tr>
        <td class="rotulo">No.DE REMISIÓN</td>
        <td class="valor verde grande">${escapar(remision.consecutivo)}</td>
        <td class="rotulo grande">HORA</td>
        <td class="valor grande">${horaRegistro(d.fechaHoraRegistro)}</td>
      </tr>
    </table>

    <table class="detalle">
      <thead>
        <tr>
          <th style="width:14%">TURNO</th>
          <th style="width:12%">ITEM</th>
          <th style="width:19%">DESCRIPCION</th>
          <th style="width:13%">FECHAS DE VENCIMIENTO</th>
          <th style="width:10%">CANT CAJAS</th>
          <th style="width:7%">CANT UNIDADES</th>
          <th style="width:7%">Nº ESTIBAS</th>
          <th style="width:18%">OBSERVACIONES</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="verde">${escapar(turno.toUpperCase())}<br>${fechaDia(d.fechaOperativa, true)}</td>
          <td>${escapar(d.codigoSnapshot)}</td>
          <td>${escapar(d.descripcionSnapshot)}</td>
          <td class="verde">${fechaDia(d.fechaVencimiento)}</td>
          <td class="verde">${d.cantidadCajas}</td>
          <td>${d.cantidadUnidades}</td>
          <td>${d.estibasCompletas},${d.cajasSueltas}</td>
          <td class="verde">${escapar(observaciones)}</td>
        </tr>
      </tbody>
    </table>

    <div class="espacio-firma"></div>
    <div class="firmas">
      <div class="firma">
        <div class="linea-firma">FIRMA QUIEN RECIBE</div>
        <div><b>Nombre:</b> ${escapar(d.opaNombre)}</div>
        <div><b>Cargo:</b> ${escapar(d.opaCargo)}</div>
        <div><b>Cliente:</b></div>
      </div>
      <div class="firma">
        <div class="linea-firma">FIRMA INLOTRANS</div>
        <div><b>Nombre:</b></div>
        <div><b>Cargo:</b></div>
      </div>
    </div>
    <div class="espacio-firma"></div>
    <div class="firmas">
      <div class="firma">
        <div class="linea-firma">FIRMA VERIFICADOR</div>
        <div><b>Nombre:</b></div>
        <div><b>Cargo:</b></div>
        <div><b>Cliente:</b></div>
      </div>
      <div class="firma"></div>
    </div>
  </section>`;
}

/** Documento completo: hojas carta verticales con dos remisiones cada una. */
export function plantillaRemisiones(remisiones: RemisionParaImprimir[]): string {
  const hojas: string[] = [];
  for (let i = 0; i < remisiones.length; i += 2) {
    const par = remisiones.slice(i, i + 2);
    hojas.push(`<div class="hoja">${par.map(bloqueRemision).join('<div class="corte"></div>')}</div>`);
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Remisiones</title>
<style>
  @page { size: letter portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; font-family: "Century Gothic", "Trebuchet MS", Arial, sans-serif; color: #000; font-size: 9pt; }
  .hoja { page-break-after: always; display: flex; flex-direction: column; height: 263mm; overflow: hidden; }
  .hoja:last-child { page-break-after: auto; }
  .corte { border-top: 1px dashed #999; margin: 2mm 0; }
  .remision { position: relative; flex: 1; padding: 1mm 0; display: flex; flex-direction: column; }

  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; }

  /* Cabecera: logo | REMISIÓN | caja vacía */
  .cabecera td { height: 9mm; vertical-align: middle; }
  .cabecera .logo { width: 26%; text-align: center; }
  .cabecera .logo img { max-height: 10mm; max-width: 60mm; }
  .cabecera .logo-texto { font-weight: bold; color: #2e7d32; letter-spacing: 1px; }
  .cabecera .titulo { width: 56%; text-align: center; font-size: 18pt; font-weight: bold; }
  .cabecera .caja-derecha { width: 18%; }

  /* Datos: fecha, lugar, número, hora */
  .datos { margin-top: 2mm; }
  .datos td { height: 6mm; padding: 0 2mm; vertical-align: middle; }
  .datos .rotulo { width: 14%; text-align: center; font-size: 9pt; }
  .datos .valor { text-align: center; font-size: 10pt; }
  .datos td:nth-child(2) { width: 31%; }
  .datos td:nth-child(3) { width: 13%; }
  .datos .grande { font-size: 14pt; }
  .verde { background: #c6efce; }

  /* Detalle */
  .detalle { margin-top: 2mm; }
  .detalle th { background: #1a237e; color: #fff; font-size: 7pt; font-weight: bold; padding: 1.5mm 1mm; text-align: center; }
  .detalle td { height: 19mm; padding: 1mm 1.5mm; text-align: center; vertical-align: middle; font-size: 14pt; }
  .detalle td:nth-child(3) { font-size: 11pt; }
  .detalle td:nth-child(8) { font-size: 12pt; }

  /* Firmas */
  /* El espacio libre de la hoja va encima de las líneas de firma. */
  .espacio-firma { flex: 1; min-height: 6.5mm; }
  .firmas { display: flex; gap: 14mm; font-size: 7.5pt; line-height: 1.2; }
  .firma { flex: 1; }
  .linea-firma { border-top: 1.5px solid #000; padding-top: 0.5mm; text-align: center; font-size: 7.5pt; margin-bottom: 1mm; }
  .firma div b { font-weight: bold; }

  /* Avisos fuera del formato */
  .marca {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 40pt; font-weight: bold; color: rgba(200, 0, 0, 0.16);
    transform: rotate(-18deg); pointer-events: none; letter-spacing: 4px; z-index: 1;
  }
  .version { display: block; text-align: center; font-size: 7pt; color: #a00; }
</style>
</head>
<body>${hojas.join('')}</body>
</html>`;
}
