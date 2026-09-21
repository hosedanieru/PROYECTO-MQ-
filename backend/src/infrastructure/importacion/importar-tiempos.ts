/**
 * IMPORTAR LA HOJA "TIEMPOS" AL CATÁLOGO DE PRODUCTOS
 * ====================================================
 *
 *   npm run importar:tiempos -- "<ruta del .xlsx>"             simula (no escribe)
 *   npm run importar:tiempos -- "<ruta del .xlsx>" --aplicar   aplica
 *   opciones: --usuario <documento>   quién queda en la auditoría
 *                                     (por defecto ADMIN_INICIAL_DOCUMENTO)
 *             --hoja <nombre>         por defecto "TIEMPOS"
 *             --con-peso-sugerido     además carga el peso neto deducido
 *                                     de la descripción (solo en vacíos)
 *
 * Qué hace por cada fila válida:
 *   - Producto nuevo → lo crea con todos los datos (incluidas cajas/hora,
 *     que al crear no exigen motivo).
 *   - Producto existente → actualiza empaque, proceso, línea ideal y
 *     subdescripción; y, si cambian, cajas/hora (y peso, si se pidió)
 *     con motivo "Importación hoja TIEMPOS" (auditado, como exige el área).
 *   - El peso deducido de la descripción se LISTA en el reporte; solo se
 *     aplica con --con-peso-sugerido, y nunca pisa un peso ya cargado.
 *
 * Todo pasa por los casos de uso (misma validación y auditoría que el
 * panel) y funciona con PostgreSQL o Firestore según PERSISTENCIA.
 * Al final escribe un reporte de excepciones en `informes/`.
 *
 * Corre sobre `dist/` (el script hace `nest build` antes): levanta el
 * contexto de NestJS, que necesita los metadatos de decoradores que
 * `tsx` no emite.
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { NestFactory } from '@nestjs/core';
import ExcelJS from 'exceljs';

import { AppModule } from '../../app.module.js';
import { CrearProductoUseCase, ActualizarProductoUseCase } from '../../application/catalogo/producto.use-cases.js';
import { ActualizarEstandarUseCase } from '../../application/mfr/catalogos-mfr.use-cases.js';
import { ErrorDominio } from '../../domain/shared/errores.js';
import { PRODUCTO_REPOSITORY, type Producto, type ProductoRepository } from '../../domain/producto/producto.repository.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../domain/usuario/usuario.repository.js';
import { leerHojaTiempos, type Celda, type ExcepcionTiempos, type FilaTiempos, type RegistroTiempos } from './hoja-tiempos.js';

const argumentos = process.argv.slice(2);
const APLICAR = argumentos.includes('--aplicar');
const CON_PESO = argumentos.includes('--con-peso-sugerido');
const opcion = (nombre: string): string | undefined => {
  const i = argumentos.indexOf(nombre);
  return i >= 0 ? argumentos[i + 1] : undefined;
};
const RUTA = argumentos.find((a) => a.toLowerCase().endsWith('.xlsx'));
const HOJA = opcion('--hoja') ?? 'TIEMPOS';
const DOCUMENTO = opcion('--usuario') ?? process.env.ADMIN_INICIAL_DOCUMENTO;

if (!RUTA) {
  console.error('Uso: npm run importar:tiempos -- "<ruta.xlsx>" [--aplicar] [--usuario <documento>] [--hoja <nombre>]');
  process.exit(1);
}

/** Valor de una celda de exceljs: número, texto, fórmula con resultado, texto enriquecido… */
function valorCelda(valor: ExcelJS.CellValue): Celda {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number' || typeof valor === 'string') return valor;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    if ('result' in valor) return valorCelda(valor.result as ExcelJS.CellValue); // fórmula
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('');
    if ('text' in valor) return String(valor.text);
    if ('error' in valor) return null;
  }
  return String(valor);
}

async function leerFilas(ruta: string, nombreHoja: string): Promise<FilaTiempos[]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const hoja = libro.getWorksheet(nombreHoja);
  if (!hoja) {
    throw new Error(`El archivo no tiene la hoja "${nombreHoja}". Hojas: ${libro.worksheets.map((h) => h.name).join(', ')}`);
  }
  const filas: FilaTiempos[] = [];
  hoja.eachRow((fila, numero) => {
    if (numero === 1) return; // encabezados
    const celdas: Celda[] = [];
    for (let c = 1; c <= 11; c++) celdas.push(valorCelda(fila.getCell(c).value));
    filas.push({ numeroFila: numero, celdas });
  });
  return filas;
}

interface Resultado {
  creados: string[];
  actualizados: Array<{ codigo: string; cambios: string[] }>;
  sinCambios: string[];
  /** Pesos deducidos de la descripción que NO se aplicaron (sin --con-peso-sugerido). */
  pesosSugeridos: Array<{ codigo: string; descripcion: string; pesoKg: number }>;
  errores: ExcepcionTiempos[];
}

function diferencias(actual: Producto, r: RegistroTiempos): { catalogo: Partial<Producto>; estandar: { cajasPorHora?: number; pesoNetoKg?: number }; texto: string[] } {
  const catalogo: Partial<Producto> = {};
  const estandar: { cajasPorHora?: number; pesoNetoKg?: number } = {};
  const texto: string[] = [];
  const comparar = <K extends keyof Producto>(campo: K, nuevo: Producto[K] | null) => {
    if (nuevo === null || nuevo === undefined || actual[campo] === nuevo) return;
    catalogo[campo] = nuevo;
    texto.push(`${campo}: ${String(actual[campo] ?? '—')} → ${String(nuevo)}`);
  };
  comparar('descripcion', r.descripcion);
  comparar('proceso', r.proceso);
  comparar('unidadesPorCaja', r.unidadesPorCaja);
  comparar('cajasPorEstiba', r.cajasPorEstiba);
  comparar('personasIdeal', r.personasIdeal);
  comparar('subdescripcion', r.subdescripcion);

  if (r.cajasPorHora !== null && actual.cajasPorHora !== r.cajasPorHora) {
    estandar.cajasPorHora = r.cajasPorHora;
    texto.push(`cajasPorHora: ${actual.cajasPorHora ?? '—'} → ${r.cajasPorHora}`);
  }
  // El peso sugerido solo llena vacíos: un peso ya cargado lo confirmó alguien.
  if (CON_PESO && r.pesoSugeridoKg !== null && actual.pesoNetoKg === null) {
    estandar.pesoNetoKg = r.pesoSugeridoKg;
    texto.push(`pesoNetoKg: — → ${r.pesoSugeridoKg} (sugerido por la descripción)`);
  }
  return { catalogo, estandar, texto };
}

async function main(): Promise<void> {
  console.log(`Importación de la hoja ${HOJA} (${APLICAR ? 'APLICANDO' : 'SIMULACIÓN, no escribe'})\n  archivo: ${RUTA}`);
  const lectura = leerHojaTiempos(await leerFilas(RUTA!, HOJA));
  console.log(`  filas válidas: ${lectura.registros.length} · excepciones de lectura: ${lectura.excepciones.length}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const resultado: Resultado = { creados: [], actualizados: [], sinCambios: [], pesosSugeridos: [], errores: [] };
  try {
    const usuarios = app.get<UsuarioRepository>(USUARIO_REPOSITORY);
    const productos = app.get<ProductoRepository>(PRODUCTO_REPOSITORY);
    const crear = app.get(CrearProductoUseCase);
    const actualizar = app.get(ActualizarProductoUseCase);
    const actualizarEstandar = app.get(ActualizarEstandarUseCase);

    const usuario = DOCUMENTO ? await usuarios.buscarPorDocumento(DOCUMENTO) : null;
    if (!usuario) {
      throw new Error(`No existe el usuario "${DOCUMENTO}" para la auditoría (use --usuario <documento>).`);
    }
    const motivo = `Importación hoja ${HOJA} (${path.basename(RUTA!)})`;

    for (const r of lectura.registros) {
      try {
        const actual = await productos.buscarPorCodigo(r.codigo);
        if (r.pesoSugeridoKg !== null && !CON_PESO && (actual === null || actual.pesoNetoKg === null)) {
          resultado.pesosSugeridos.push({ codigo: r.codigo, descripcion: r.descripcion, pesoKg: r.pesoSugeridoKg });
        }
        if (!actual) {
          if (APLICAR) {
            await crear.ejecutar({
              codigo: r.codigo, descripcion: r.descripcion, proceso: r.proceso,
              unidadesPorCaja: r.unidadesPorCaja, cajasPorEstiba: r.cajasPorEstiba,
              personasIdeal: r.personasIdeal, subdescripcion: r.subdescripcion,
              cajasPorHora: r.cajasPorHora, pesoNetoKg: CON_PESO ? r.pesoSugeridoKg : null,
              usuarioId: usuario.id,
            });
          }
          resultado.creados.push(r.codigo);
          continue;
        }

        const dif = diferencias(actual, r);
        if (dif.texto.length === 0) {
          resultado.sinCambios.push(r.codigo);
          continue;
        }
        if (APLICAR) {
          if (Object.keys(dif.catalogo).length > 0) {
            await actualizar.ejecutar({ productoId: actual.id, cambios: dif.catalogo, usuarioId: usuario.id });
          }
          if (Object.keys(dif.estandar).length > 0) {
            await actualizarEstandar.ejecutar({
              productoId: actual.id,
              cajasPorHora: dif.estandar.cajasPorHora ?? actual.cajasPorHora,
              pesoNetoKg: dif.estandar.pesoNetoKg ?? actual.pesoNetoKg,
              motivo,
              usuarioId: usuario.id,
            });
          }
        }
        resultado.actualizados.push({ codigo: r.codigo, cambios: dif.texto });
      } catch (error) {
        const mensaje = error instanceof ErrorDominio ? `${error.codigo}: ${error.message}` : error instanceof Error ? error.message : String(error);
        resultado.errores.push({ numeroFila: r.numeroFila, codigo: r.codigo, motivo: mensaje });
      }
    }
  } finally {
    await app.close();
  }

  const excepciones = [...lectura.excepciones, ...resultado.errores].sort((a, b) => a.numeroFila - b.numeroFila);
  const lineas = [
    `# Importación hoja ${HOJA} — ${new Date().toISOString()}`,
    `Archivo: ${RUTA}`,
    `Modo: ${APLICAR ? 'APLICADO' : 'SIMULACIÓN (nada se escribió)'}`,
    '',
    `## Resumen`,
    `- Creados: ${resultado.creados.length}`,
    `- Actualizados: ${resultado.actualizados.length}`,
    `- Sin cambios: ${resultado.sinCambios.length}`,
    `- Excepciones: ${excepciones.length}`,
    `- Pesos sugeridos sin aplicar: ${resultado.pesosSugeridos.length}`,
    '',
    `## Creados`,
    ...(resultado.creados.length ? resultado.creados.map((c) => `- ${c}`) : ['(ninguno)']),
    '',
    `## Actualizados`,
    ...(resultado.actualizados.length
      ? resultado.actualizados.flatMap((a) => [`- ${a.codigo}`, ...a.cambios.map((c) => `    - ${c}`)])
      : ['(ninguno)']),
    '',
    `## Excepciones (revisión manual)`,
    ...(excepciones.length ? excepciones.map((e) => `- fila ${e.numeroFila} · ${e.codigo ?? '(sin código)'}: ${e.motivo}`) : ['(ninguna)']),
    '',
    `## Pesos deducidos de la descripción — NO aplicados (use --con-peso-sugerido o cárguelos en Admin → Productos)`,
    ...(resultado.pesosSugeridos.length
      ? resultado.pesosSugeridos.map((p) => `- ${p.codigo} · ${p.descripcion}: ${p.pesoKg} kg`)
      : [CON_PESO ? '(aplicados)' : '(ninguno)']),
    '',
  ];
  const carpeta = path.resolve(process.cwd(), 'informes');
  mkdirSync(carpeta, { recursive: true });
  const reporte = path.join(carpeta, `importacion-tiempos-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`);
  writeFileSync(reporte, lineas.join('\n'), 'utf8');

  console.log(`\n${lineas.slice(4, 10).join('\n')}`);
  console.log(`\nExcepciones (${excepciones.length}):`);
  for (const e of excepciones.slice(0, 40)) console.log(`  fila ${e.numeroFila} · ${e.codigo ?? '(sin código)'}: ${e.motivo}`);
  if (excepciones.length > 40) console.log(`  … y ${excepciones.length - 40} más (ver el reporte)`);
  console.log(`\nReporte completo: ${reporte}`);
}

main().catch((error) => {
  console.error('Error en la importación:', error instanceof Error ? error.message : error);
  process.exit(1);
});
