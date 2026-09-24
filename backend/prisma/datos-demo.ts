/**
 * DATOS DE DEMOSTRACIÓN
 * =====================
 *
 * Llena la base LOCAL con cuatro días de operación inventados, para
 * poder enseñar el aplicativo funcionando. NO son datos del área: son
 * ejemplos construidos a partir del DPP para que las cifras cuadren
 * entre sí.
 *
 * Qué genera:
 *   · 6 productos con su estándar (cajas/hora, peso por caja, línea ideal)
 *   · 4 días operativos (hoy y los tres anteriores) con su programación
 *   · asistencia y asignación de grupos a líneas en cada turno
 *   · remisiones derivadas de cada bloque del DPP, no inventadas sueltas:
 *     por eso el MFR da un número creíble en vez de un porcentaje al azar
 *
 * Los tres días anteriores están cerrados (93–99 % de cumplimiento). El
 * día de hoy va como va una jornada real a media marcha: el T1 cerrado,
 * el T2 avanzando según la hora que sea, y el T3 sin empezar.
 *
 * SEGURIDAD
 * ---------
 *   1. Se niega a correr si PERSISTENCIA no es `postgres`: los datos
 *      inventados NUNCA deben tocar el Firestore del área.
 *   2. Borra TODAS las remisiones de la base local antes de generar. En
 *      producción una remisión no se borra jamás (es un documento
 *      firmado); aquí es una base de pruebas y se parte de cero para que
 *      los números cuadren.
 *   3. Deja el contador de consecutivos al día, para que una remisión
 *      creada a mano durante la demostración no choque con estas.
 *
 *   npm run demo:datos
 */

import 'dotenv/config';

import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client.js';

const MARCA_DEMO = '[DEMO]';
const DIAS_HISTORICO = 3;

if ((process.env.PERSISTENCIA ?? 'postgres').toLowerCase() !== 'postgres') {
  console.error(
    'Este script solo corre con PERSISTENCIA=postgres. Los datos de demostración ' +
      'NUNCA deben escribirse en el Firestore del área.',
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ---------- Tiempo ----------

/** Día operativo actual: fecha(ahora − 6 h) en hora de Bogotá. */
function fechaOperativaHoy(): Date {
  const hace6h = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(hace6h);
  return new Date(`${iso}T00:00:00.000Z`);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 24 * 3600_000);
}

const minutosDeReloj = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

/** Minutos desde las 06:00 del día operativo. */
const minutosOperativos = (hora: string): number =>
  (minutosDeReloj(hora) - 6 * 60 + 24 * 60) % (24 * 60);

/** Minuto operativo en el que estamos ahora mismo, en hora de Bogotá. */
function minutoOperativoActual(): number {
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
  return minutosOperativos(hora);
}

/** Instante real de un minuto operativo del día. Bogotá es UTC−5 todo el año. */
function instanteDeMinuto(fechaOperativa: Date, minutoOperativo: number): Date {
  return new Date(fechaOperativa.getTime() + (6 + 5) * 3600_000 + minutoOperativo * 60_000);
}

const horasEntre = (inicio: string, fin: string): number => {
  const minutos = minutosDeReloj(fin) - minutosDeReloj(inicio);
  return (minutos <= 0 ? minutos + 24 * 60 : minutos) / 60;
};

// ---------- Catálogo inventado ----------

const PRODUCTOS = [
  { codigo: '300058141', descripcion: 'SURTIDO MEGA LONCHERA X 24', subdescripcion: 'SURTIDO', unidadesPorCaja: 24, cajasPorHora: 260, pesoNetoKg: 2.35, personasIdeal: 6 },
  { codigo: '300033679', descripcion: 'MIX FIESTA FAMILIAR X 18', subdescripcion: 'MULTIPACK', unidadesPorCaja: 18, cajasPorHora: 240, pesoNetoKg: 1.9, personasIdeal: 6 },
  { codigo: '300041255', descripcion: 'DORITOS QUESO PACK X 12', subdescripcion: 'MULTIPACK', unidadesPorCaja: 12, cajasPorHora: 300, pesoNetoKg: 1.44, personasIdeal: 5 },
  { codigo: '300047812', descripcion: 'CHEETOS MIX PACK X 20', subdescripcion: 'MULTIPACK', unidadesPorCaja: 20, cajasPorHora: 280, pesoNetoKg: 1.6, personasIdeal: 5 },
  { codigo: '300052004', descripcion: 'OFERTA NATUCHIPS X 15', subdescripcion: 'OFERTA', unidadesPorCaja: 15, cajasPorHora: 210, pesoNetoKg: 1.75, personasIdeal: 4 },
  { codigo: '300060118', descripcion: 'REEMPAQUE SURTIDO X 30', subdescripcion: 'REEMPAQUE', unidadesPorCaja: 30, cajasPorHora: 180, pesoNetoKg: 2.8, personasIdeal: 7 },
] as const;

const TURNOS = [
  { codigo: 'T1', horaInicio: '06:00', horaFin: '13:30' },
  { codigo: 'T2', horaInicio: '14:00', horaFin: '21:30' },
  { codigo: 'T3', horaInicio: '22:00', horaFin: '05:30' },
] as const;

/** Qué línea corre qué SKU en cada turno. Se repite todos los días. */
const PLAN = [
  { linea: 'L1', turno: 'T1', producto: 0, eficiencia: 88 },
  { linea: 'L2', turno: 'T1', producto: 2, eficiencia: 85 },
  { linea: 'L3', turno: 'T1', producto: 4, eficiencia: 82 },
  { linea: 'L1', turno: 'T2', producto: 1, eficiencia: 87 },
  { linea: 'L2', turno: 'T2', producto: 3, eficiencia: 86 },
  { linea: 'MANUAL-1', turno: 'T2', producto: 5, eficiencia: 78 },
  { linea: 'L1', turno: 'T3', producto: 0, eficiencia: 84 },
  { linea: 'L3', turno: 'T3', producto: 2, eficiencia: 83 },
] as const;

/** Cumplimiento de cada día cerrado. Varía para que el histórico no sea plano. */
const CUMPLIMIENTO_HISTORICO = [0.97, 0.93, 0.99];

const ESPERADAS_POR_GRUPO = [8, 8, 6, 4];

type EstadoRemision =
  | 'BORRADOR'
  | 'ENTREGADA'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'EN_RECTIFICACION'
  | 'VALIDADA';

interface RemisionPlanificada {
  productoIndice: number;
  turnoCodigo: string;
  cajas: number;
  minutoOperativo: number;
  estado: EstadoRemision;
  extraoficial?: boolean;
}

/**
 * Reparte lo producido de un bloque en 2 o 3 remisiones, con su hora
 * dentro del rango del bloque. Así las cantidades suman exactamente lo
 * que dice el cumplimiento pedido, en vez de ser números sueltos.
 */
function repartir(
  total: number,
  partes: number,
  minutoInicio: number,
  duracion: number,
): Array<{ cajas: number; minutoOperativo: number }> {
  if (total <= 0) return [];
  const base = Math.floor(total / partes);
  return Array.from({ length: partes }, (_, i) => ({
    // La última parte se queda con el residuo: la suma es exacta.
    cajas: i === partes - 1 ? total - base * (partes - 1) : base,
    minutoOperativo: Math.round(minutoInicio + (duracion * (i + 1)) / (partes + 1)),
  }));
}

async function main(): Promise<void> {
  const hoy = fechaOperativaHoy();
  const minutoActual = minutoOperativoActual();

  console.log(`Día operativo de hoy: ${hoy.toISOString().slice(0, 10)}`);
  console.log(`Minuto operativo actual: ${minutoActual} (06:00 = 0)\n`);

  const admin = await prisma.usuario.findFirst({ where: { rol: { codigo: 'ADMINISTRADOR' } } });
  if (!admin) throw new Error('No hay administrador. Corre primero `npx prisma db seed`.');

  const lugar = await prisma.lugar.findFirst();
  const turnos = await prisma.turno.findMany();
  const grupos = await prisma.grupo.findMany({ orderBy: { codigo: 'asc' } });
  const lineas = await prisma.lineaProduccion.findMany({ orderBy: { orden: 'asc' } });
  if (!lugar || turnos.length === 0 || grupos.length === 0 || lineas.length === 0) {
    throw new Error('Faltan catálogos. Corre primero `npx prisma db seed`.');
  }

  const turnoDe = (codigo: string) => {
    const t = turnos.find((x) => x.codigo === codigo);
    if (!t) throw new Error(`No existe el turno ${codigo}`);
    return t;
  };
  const lineaDe = (codigo: string) => {
    const l = lineas.find((x) => x.codigo === codigo);
    if (!l) throw new Error(`No existe la línea ${codigo}`);
    return l;
  };

  const dias = Array.from({ length: DIAS_HISTORICO + 1 }, (_, i) => sumarDias(hoy, i - DIAS_HISTORICO));

  // ---------- Barrido ----------
  const borradas = await prisma.remision.count();
  await prisma.remisionEstiba.deleteMany({});
  await prisma.remisionVersion.deleteMany({});
  await prisma.remision.deleteMany({});
  for (const dia of dias) {
    await prisma.bloqueProgramacion.deleteMany({ where: { fechaOperativa: dia } });
    await prisma.asignacionLinea.deleteMany({ where: { fechaOperativa: dia } });
    await prisma.asistenciaTurno.deleteMany({ where: { fechaOperativa: dia } });
  }
  console.log(`Barrido: ${borradas} remisiones eliminadas de la base local.`);

  // ---------- Productos ----------
  const productos = [];
  for (const p of PRODUCTOS) {
    productos.push(
      await prisma.producto.upsert({
        where: { codigo: p.codigo },
        update: {
          descripcion: p.descripcion,
          subdescripcion: p.subdescripcion,
          unidadesPorCaja: p.unidadesPorCaja,
          cajasPorHora: p.cajasPorHora,
          pesoNetoKg: p.pesoNetoKg,
          personasIdeal: p.personasIdeal,
          activo: true,
        },
        create: {
          codigo: p.codigo,
          descripcion: p.descripcion,
          subdescripcion: p.subdescripcion,
          proceso: 'AUTOMATICA',
          unidadesPorCaja: p.unidadesPorCaja,
          cajasPorEstiba: 60,
          cajasPorHora: p.cajasPorHora,
          pesoNetoKg: p.pesoNetoKg,
          personasIdeal: p.personasIdeal,
        },
      }),
    );
  }

  /*
   * Acceso garantizado a la cuenta inicial.
   *
   * `prisma db seed` NO pisa la contraseña de un administrador que ya
   * existe, y hace bien: en producción sería regalarle la cuenta a
   * cualquiera que lea el .env. Pero en esta base de pruebas eso deja
   * la cuenta `admin` con la clave de un seed antiguo y nadie puede
   * entrar a la demostración.
   *
   * Aquí se sincroniza con el .env. Solo afecta a ESA cuenta y solo
   * corre con PERSISTENCIA=postgres (comprobado al arrancar el script).
   */
  const documentoAdmin = process.env.ADMIN_INICIAL_DOCUMENTO?.trim();
  const claveAdmin = process.env.ADMIN_INICIAL_PASSWORD;
  if (documentoAdmin && claveAdmin) {
    const cuenta = await prisma.usuario.findUnique({ where: { documento: documentoAdmin } });
    if (cuenta && !(await bcrypt.compare(claveAdmin, cuenta.passwordHash))) {
      await prisma.usuario.update({
        where: { documento: documentoAdmin },
        data: { passwordHash: await bcrypt.hash(claveAdmin, 10), activo: true },
      });
      console.log(`Contraseña de "${documentoAdmin}" sincronizada con ADMIN_INICIAL_PASSWORD del .env.`);
    }
  }

  // Personas esperadas: sin ellas el semáforo de personal no compara nada.
  for (const [indice, grupo] of grupos.entries()) {
    await prisma.grupo.update({
      where: { id: grupo.id },
      data: { personasEsperadas: ESPERADAS_POR_GRUPO[indice % ESPERADAS_POR_GRUPO.length] },
    });
  }

  // ---------- Días ----------
  let numero = 0;
  const anio = hoy.getUTCFullYear();
  const vencimiento = sumarDias(hoy, 120);

  for (const [indiceDia, dia] of dias.entries()) {
    const esHoy = indiceDia === dias.length - 1;
    const etiqueta = dia.toISOString().slice(0, 10);
    const planificadas: RemisionPlanificada[] = [];

    // --- Programación del día ---
    for (const item of PLAN) {
      const turno = TURNOS.find((t) => t.codigo === item.turno)!;
      const producto = PRODUCTOS[item.producto];
      const horas = horasEntre(turno.horaInicio, turno.horaFin);
      const target = Math.round(producto.cajasPorHora * horas * (item.eficiencia / 100));

      await prisma.bloqueProgramacion.create({
        data: {
          fechaOperativa: dia,
          lineaId: lineaDe(item.linea).id,
          turnoId: turnoDe(item.turno).id,
          productoId: productos[item.producto].id,
          horaInicio: turno.horaInicio,
          horaFin: turno.horaFin,
          cajasPorHora: producto.cajasPorHora,
          eficienciaPorcentaje: item.eficiencia,
          personasAsignadas: producto.personasIdeal,
          origen: 'DPP',
          creadoPorId: admin.id,
        },
      });

      // --- Cuánto se produjo de ese bloque ---
      const inicioTurno = minutosOperativos(turno.horaInicio);
      const duracion = horas * 60;

      let avance: number;
      if (!esHoy) {
        avance = CUMPLIMIENTO_HISTORICO[indiceDia % CUMPLIMIENTO_HISTORICO.length];
      } else if (minutoActual >= inicioTurno + duracion) {
        avance = 0.965; // turno terminado
      } else if (minutoActual <= inicioTurno) {
        avance = 0; // todavía no empieza
      } else {
        // En curso: proporcional a lo que lleva corrido.
        avance = ((minutoActual - inicioTurno) / duracion) * 0.95;
      }

      const producido = Math.round(target * avance);
      if (producido <= 0) continue;

      for (const parte of repartir(producido, 3, inicioTurno, duracion)) {
        planificadas.push({
          productoIndice: item.producto,
          turnoCodigo: item.turno,
          cajas: parte.cajas,
          minutoOperativo: parte.minutoOperativo,
          // Lo de días cerrados ya está conciliado; lo de hoy, aprobado.
          estado: esHoy ? 'APROBADA' : 'VALIDADA',
        });
      }
    }

    // --- El desvío del flujo y lo que está en curso, solo hoy ---
    if (esHoy && planificadas.length > 0) {
      const ultimoMinuto = Math.max(...planificadas.map((r) => r.minutoOperativo));

      /*
       * Las primeras del turno ya se conciliaron. Conciliar va detrás de
       * aprobar (son dos eventos distintos), así que lo temprano está
       * VALIDADA y lo reciente sigue APROBADA: es como se ve de verdad a
       * media jornada, y además deja los cuatro pasos del flujo con
       * contenido.
       */
      for (const r of [...planificadas].sort((a, b) => a.minutoOperativo - b.minutoOperativo).slice(0, 4)) {
        if (r.estado === 'APROBADA') r.estado = 'VALIDADA';
      }

      planificadas.push(
        // Pedido de emergencia: fuera del MFR y fuera del tope.
        { productoIndice: 2, turnoCodigo: 'T1', cajas: 120, minutoOperativo: 300, estado: 'APROBADA', extraoficial: true },
        // Rechazada por el OPA y su corrección en curso.
        { productoIndice: 4, turnoCodigo: 'T1', cajas: 240, minutoOperativo: 380, estado: 'RECHAZADA' },
        { productoIndice: 4, turnoCodigo: 'T1', cajas: 190, minutoOperativo: 300, estado: 'EN_RECTIFICACION' },
        // Lo último: entregado al OPA y borradores sin entregar.
        { productoIndice: 0, turnoCodigo: 'T1', cajas: 300, minutoOperativo: ultimoMinuto + 5, estado: 'ENTREGADA' },
        { productoIndice: 2, turnoCodigo: 'T1', cajas: 280, minutoOperativo: ultimoMinuto + 12, estado: 'ENTREGADA' },
        { productoIndice: 0, turnoCodigo: 'T1', cajas: 310, minutoOperativo: ultimoMinuto + 20, estado: 'BORRADOR' },
        { productoIndice: 2, turnoCodigo: 'T1', cajas: 275, minutoOperativo: ultimoMinuto + 26, estado: 'BORRADOR' },
      );
    }

    // --- Asistencia y asignación ---
    for (const turno of turnos) {
      for (const [indice, grupo] of grupos.entries()) {
        const esperadas = ESPERADAS_POR_GRUPO[indice % ESPERADAS_POR_GRUPO.length];
        // Un grupo llega incompleto a propósito: el semáforo de personal
        // tiene que poder enseñarse en sus dos estados.
        const llegaron = indice === 1 ? Math.max(esperadas - 2, 1) : esperadas;

        await prisma.asistenciaTurno.create({
          data: {
            fechaOperativa: dia,
            turnoId: turno.id,
            grupoId: grupo.id,
            personasLlegaron: llegaron,
            observacion: indice === 1 ? 'Dos personas con incapacidad' : null,
            registradaPorId: admin.id,
          },
        });

        await prisma.asignacionLinea.create({
          data: {
            fechaOperativa: dia,
            turnoId: turno.id,
            lineaId: lineas[indice % 4].id,
            grupoId: grupo.id,
            personas: Math.max(Math.floor(llegaron / 2), 1),
            registradaPorId: admin.id,
          },
        });
      }
    }

    // --- Remisiones ---
    planificadas.sort((a, b) => a.minutoOperativo - b.minutoOperativo);

    for (const [indice, r] of planificadas.entries()) {
      const producto = productos[r.productoIndice];
      const registro = instanteDeMinuto(dia, r.minutoOperativo);
      const estibas = Math.max(Math.floor(r.cajas / 60), 1);
      const aprobada = r.estado === 'APROBADA' || r.estado === 'VALIDADA';
      const rechazada = r.estado === 'RECHAZADA' || r.estado === 'EN_RECTIFICACION';

      await prisma.remision.create({
        data: {
          anio,
          numero: ++numero,
          fechaOperativa: dia,
          fechaHoraRegistro: registro,
          turnoId: turnoDe(r.turnoCodigo).id,
          grupoId: grupos[indice % grupos.length].id,
          lugarId: lugar.id,
          productoId: producto.id,
          codigoSnapshot: producto.codigo,
          descripcionSnapshot: producto.descripcion,
          fechaVencimiento: vencimiento,
          cantidadCajas: r.cajas,
          cantidadUnidades: r.cajas * (producto.unidadesPorCaja ?? 1),
          estibasCompletas: estibas,
          cajasSueltas: r.cajas % 60,
          observaciones: `${MARCA_DEMO} registro de ejemplo para presentación`,
          extraoficial: r.extraoficial === true,
          motivoExtraoficial: r.extraoficial === true ? 'Pedido de emergencia solicitado por PepsiCo' : null,
          estado: r.estado,
          creadaPorId: admin.id,
          entregadaPorId: r.estado === 'BORRADOR' ? null : admin.id,
          fechaEntrega: r.estado === 'BORRADOR' ? null : new Date(registro.getTime() + 25 * 60_000),
          opaNombre: aprobada ? 'Carlos Ramírez' : null,
          opaCargo: aprobada ? 'Facturador OPA' : null,
          fechaAprobacion: aprobada ? new Date(registro.getTime() + 55 * 60_000) : null,
          motivoUltimoRechazo: rechazada
            ? 'Diferencia en el conteo de cajas contra el documento'
            : null,
          validadaPorId: r.estado === 'VALIDADA' ? admin.id : null,
          fechaValidacion: r.estado === 'VALIDADA' ? new Date(registro.getTime() + 140 * 60_000) : null,
          conciliadoCon: r.estado === 'VALIDADA' ? 'Ana Suárez — conciliación PepsiCo' : null,
          estibas: {
            create: Array.from({ length: estibas }, (_, i) => ({
              numeroEstiba: 100 + (numero % 40) * 10 + i,
            })),
          },
        },
      });
    }

    console.log(`  ${etiqueta}${esHoy ? ' (hoy)' : '        '}  ${PLAN.length} bloques · ${planificadas.length} remisiones`);
  }

  // ---------- Consecutivo al día ----------
  // Si el contador queda atrás, la primera remisión creada a mano en la
  // demostración chocaría con una de estas por la restricción única.
  await prisma.consecutivo.upsert({
    where: { tipo_anio: { tipo: 'REMISION', anio } },
    update: { ultimo: numero },
    create: { tipo: 'REMISION', anio, ultimo: numero },
  });

  console.log(`\nTotal: ${numero} remisiones en ${dias.length} días. Consecutivo ${anio} en ${numero}.`);
  console.log('Entra con el usuario administrador del .env (ADMIN_INICIAL_DOCUMENTO).');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
