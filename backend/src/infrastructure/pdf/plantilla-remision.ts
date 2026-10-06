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
 * Firmas electrónicas (2026-10-05): cada casilla firmada lleva el trazo
 * sobre la línea, nombre, cargo y lo que se declaró; abajo, la constancia
 * con documento, fecha/hora y la huella SHA-256 (y "PILOTO" mientras no
 * haya aval de PepsiCo y del área legal: FIRMA_ELECTRONICA_PILOTO).
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
import type { FirmaRemision, TipoFirma } from '../../domain/remision/firma-remision.js';
import { escapar, fechaDia, fechaRegistro, horaRegistro } from './formato.js';

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

const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: 'BORRADOR',
  ENTREGADA: 'SIN APROBAR',
  RECHAZADA: 'RECHAZADA',
  EN_RECTIFICACION: 'EN RECTIFICACIÓN',
};

/** El cargo impreso en la casilla: el nombre del rol, no su código. */
const CARGO_DE_ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  COORDINADOR_MQ: 'Coordinador MQ',
  PATINADOR: 'Patinador',
  OPA_PEPSICO: 'OPA PepsiCo',
};
const cargo = (f: FirmaRemision | undefined) => (f ? CARGO_DE_ROL[f.usuarioRol] ?? f.usuarioRol : undefined);

/** El trazo va encima de la línea de su casilla. */
function trazo(f: FirmaRemision | undefined): string {
  return f ? `<img class="trazo" src="${f.trazo}" alt="Firma de ${escapar(f.usuarioNombre)}">` : '';
}

/** Lo que el firmante declaró (copia guardada en la firma). */
function declaracion(f: FirmaRemision | undefined): string {
  return f ? `<div class="declaracion">${escapar(f.declaracion)}</div>` : '';
}

/**
 * Constancia de firma electrónica: quién, cuándo y la huella del
 * contenido firmado. Mientras PepsiCo y el área legal no den el aval
 * (PENDIENTE), se marca como PILOTO.
 */
function constancia(firmas: FirmaRemision[], piloto: boolean): string {
  if (firmas.length === 0) return '';
  const lista = firmas
    .map((f) => `${escapar(f.tipo)}: ${escapar(f.usuarioNombre)} (doc. ${escapar(f.usuarioDocumento)}) ${fechaRegistro(f.fechaHora)} ${horaRegistro(f.fechaHora)}`)
    .join(' · ');
  return `<div class="constancia">
    ${piloto ? '<b>PILOTO — conserve también la remisión firmada en papel.</b> ' : ''}
    Firmado electrónicamente con usuario y contraseña (Ley 527 de 1999): ${lista}.
    Huella SHA-256 del documento firmado: ${escapar(firmas[0].huella)}
  </div>`;
}

function bloqueRemision({ remision, turno, lugar, firmas }: RemisionParaImprimir, piloto: boolean): string {
  const d = remision.aObjeto();
  const firma = (tipo: TipoFirma) => firmas.find((f) => f.tipo === tipo);
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
        ${trazo(firma('RECIBE'))}
        <div class="linea-firma">FIRMA QUIEN RECIBE</div>
        <div><b>Nombre:</b> ${escapar(firma('RECIBE')?.usuarioNombre ?? d.opaNombre)}</div>
        <div><b>Cargo:</b> ${escapar(cargo(firma('RECIBE')) ?? d.opaCargo)}</div>
        <div><b>Cliente:</b></div>
      </div>
      <div class="firma">
        ${trazo(firma('INLOTRANS'))}
        <div class="linea-firma">FIRMA INLOTRANS</div>
        <div><b>Nombre:</b> ${escapar(firma('INLOTRANS')?.usuarioNombre)}</div>
        <div><b>Cargo:</b> ${escapar(cargo(firma('INLOTRANS')))}</div>
        ${declaracion(firma('INLOTRANS'))}
      </div>
    </div>
    <div class="espacio-firma"></div>
    <div class="firmas">
      <div class="firma">
        ${trazo(firma('VERIFICADOR'))}
        <div class="linea-firma">FIRMA VERIFICADOR</div>
        <div><b>Nombre:</b> ${escapar(firma('VERIFICADOR')?.usuarioNombre)}</div>
        <div><b>Cargo:</b> ${escapar(cargo(firma('VERIFICADOR')))}</div>
        <div><b>Cliente:</b></div>
        ${declaracion(firma('VERIFICADOR'))}
      </div>
      <div class="firma"></div>
    </div>
    ${constancia(firmas, piloto)}
  </section>`;
}

/** Documento completo: hojas carta verticales con dos remisiones cada una. */
export function plantillaRemisiones(remisiones: RemisionParaImprimir[], opciones: { pilotoFirmas: boolean } = { pilotoFirmas: true }): string {
  const hojas: string[] = [];
  for (let i = 0; i < remisiones.length; i += 2) {
    const par = remisiones.slice(i, i + 2);
    hojas.push(`<div class="hoja">${par.map((r) => bloqueRemision(r, opciones.pilotoFirmas)).join('<div class="corte"></div>')}</div>`);
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
  /* Firma electrónica: el trazo sobre la línea, la declaración y la constancia. */
  .trazo { display: block; height: 10mm; max-width: 55mm; margin: 0 auto -1mm; object-fit: contain; }
  .declaracion { font-size: 6pt; font-style: italic; color: #333; }
  .constancia { margin-top: 1mm; font-size: 5.5pt; line-height: 1.25; color: #333; word-break: break-all; }

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
