import { beforeEach, describe, expect, it } from 'vitest';

import {
  ContrasenaFirmaIncorrectaError,
  FirmaFueraDeTiempoError,
  FirmaInvalidaError,
  FirmaYaRegistradaError,
  FirmasIncompletasError,
  exigirFirmasPara,
  verificarPuedeFirmar,
  type FirmaRemision,
} from '../../domain/remision/firma-remision.js';
import { Remision, type EstadoRemision } from '../../domain/remision/remision.entity.js';
import { Usuario } from '../../domain/usuario/usuario.entity.js';
import { PermisoDenegadoError } from '../../domain/usuario/usuario.errors.js';
import {
  AuditoriaRepositorioFalso,
  HashFalso,
  RemisionRepositorioEnMemoria,
  UnidadDeTrabajoFalsa,
  UsuarioRepositorioFalso,
} from '../pruebas/dobles-en-memoria.js';
import { CalculadorHuellaFalso, FirmaRemisionRepositorioFalso } from '../pruebas/dobles-firma.js';
import { ConsultarFirmasUseCase, FirmaDeRemision, FirmarRemisionUseCase } from './firma-remision.use-cases.js';
import { ValidarRemisionUseCase } from './flujo-remision.use-cases.js';

const AHORA = new Date('2026-10-05T13:00:00Z');
const TRAZO = `data:image/png;base64,${'iVBORw0KGgo'.repeat(30)}`;

function remision(estado: EstadoRemision, extra: Record<string, unknown> = {}): Remision {
  const base = Remision.crear({
    anio: 2026, numero: 7, fechaOperativa: new Date('2026-10-05T00:00:00Z'), fechaHoraRegistro: AHORA, turnoId: 'T1', grupoId: 'g', lugarId: 'l',
    productoId: 'A', codigoSnapshot: '300058141', descripcionSnapshot: 'SURTIDO', fechaVencimiento: new Date('2027-01-01T00:00:00Z'),
    cantidadCajas: 36, cantidadUnidades: 144, estibasCompletas: 1, cajasSueltas: 0, numerosEstiba: [1], creadaPorId: 'c',
  });
  return Remision.desdePersistencia({ ...base.aObjeto(), id: 'r1', estado, ...extra });
}

function usuario(id: string, rolCodigo: string, permisos: string[]): Usuario {
  return Usuario.desdePersistencia({
    id, documento: `doc-${id}`, nombre: `Nombre ${id}`, email: null, passwordHash: 'hash(clave-correcta)', rolId: rolCodigo, rolCodigo, permisos, activo: true,
  });
}

describe('Firma electrónica de la remisión', () => {
  let remisiones: RemisionRepositorioEnMemoria;
  let firmas: FirmaRemisionRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let usuarios: UsuarioRepositorioFalso;
  let firmar: FirmarRemisionUseCase;
  let consultar: ConsultarFirmasUseCase;
  const huella = new CalculadorHuellaFalso();

  const comando = (extra: Record<string, unknown> = {}) => ({
    remisionId: 'r1', tipo: 'VERIFICADOR' as const, trazo: TRAZO, contrasena: 'clave-correcta', usuarioId: 'patinador',
    dispositivo: 'Chrome en Windows', ip: '10.0.0.5', ...extra,
  });

  beforeEach(() => {
    remisiones = new RemisionRepositorioEnMemoria();
    remisiones.agregar('r1', remision('ENTREGADA'));
    firmas = new FirmaRemisionRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    usuarios = new UsuarioRepositorioFalso();
    usuarios.agregar(usuario('patinador', 'PATINADOR', ['remision.consultar', 'remision.firmar_verificacion']));
    usuarios.agregar(usuario('coordinador', 'COORDINADOR_MQ', ['remision.consultar', 'remision.firmar_emision']));
    const uow = new UnidadDeTrabajoFalsa({ remisiones, firmasRemision: firmas, auditoria });
    firmar = new FirmarRemisionUseCase(uow, new FirmaDeRemision(usuarios, new HashFalso(), huella, { ahora: () => AHORA }));
    consultar = new ConsultarFirmasUseCase(remisiones, firmas, huella);
  });

  it('firma con contraseña: guarda quién, cuándo, equipo, declaración y huella; audita sin el trazo', async () => {
    const firma = await firmar.ejecutar(comando());
    expect(firma).toMatchObject({
      tipo: 'VERIFICADOR', version: 1, usuarioNombre: 'Nombre patinador', usuarioDocumento: 'doc-patinador', usuarioRol: 'PATINADOR',
      declaracion: 'Certifico el conteo físico de las cantidades de esta remisión.', dispositivo: 'Chrome en Windows', ip: '10.0.0.5', fechaHora: AHORA,
    });
    expect(firma.huella).toMatch(/^huella-/);
    const entrada = auditoria.entradas.at(-1)!;
    expect(entrada).toMatchObject({ entidad: 'remision', entidadId: 'r1', usuarioId: 'patinador' });
    expect(JSON.stringify(entrada)).not.toContain('base64');
    expect(JSON.stringify(entrada)).not.toContain('clave-correcta');
  });

  it('contraseña incorrecta o sin permiso de esa casilla: no firma', async () => {
    await expect(firmar.ejecutar(comando({ contrasena: 'otra' }))).rejects.toBeInstanceOf(ContrasenaFirmaIncorrectaError);
    await expect(firmar.ejecutar(comando({ tipo: 'INLOTRANS' }))).rejects.toBeInstanceOf(PermisoDenegadoError);
    expect(firmas.firmas).toHaveLength(0);
  });

  it('trazo vacío o que no es PNG: inválido', async () => {
    await expect(firmar.ejecutar(comando({ trazo: '' }))).rejects.toBeInstanceOf(FirmaInvalidaError);
    await expect(firmar.ejecutar(comando({ trazo: `data:image/jpeg;base64,${'A'.repeat(300)}` }))).rejects.toBeInstanceOf(FirmaInvalidaError);
    await expect(firmar.ejecutar(comando({ trazo: `data:image/png;base64,${'A'.repeat(200)}"><script>` }))).rejects.toBeInstanceOf(FirmaInvalidaError);
  });

  it('el OPA (RECIBE) firma solo después del verificador de la misma versión, y nunca como firma suelta', async () => {
    const r = remision('ENTREGADA');
    const verificador = { tipo: 'VERIFICADOR', version: 1 } as FirmaRemision;
    expect(() => verificarPuedeFirmar(r, 'RECIBE', [])).toThrow(/Primero debe firmar el verificador/);
    expect(() => verificarPuedeFirmar(r, 'RECIBE', [{ ...verificador, version: 0 }])).toThrow(FirmaFueraDeTiempoError);
    expect(() => verificarPuedeFirmar(r, 'RECIBE', [verificador])).not.toThrow();
    // Por el endpoint de firma suelta no: la de quien recibe va con la aprobación.
    await expect(firmar.ejecutar(comando({ tipo: 'RECIBE' }))).rejects.toThrow(/al aprobar/);
  });

  it('fin del piloto: aprobar y validar solo firmando y con las firmas previas de la versión', () => {
    const r = remision('ENTREGADA');
    const f = (tipo: FirmaRemision['tipo'], version = 1) => ({ tipo, version }) as FirmaRemision;
    // En piloto no exige nada.
    expect(() => exigirFirmasPara('APROBAR', 'PILOTO', r, [], false)).not.toThrow();
    // Obligatoria: aprobar sin firmar (transcrita) ya no se permite.
    expect(() => exigirFirmasPara('APROBAR', 'OBLIGATORIA', r, [f('INLOTRANS'), f('VERIFICADOR')], false)).toThrow(FirmasIncompletasError);
    expect(() => exigirFirmasPara('APROBAR', 'OBLIGATORIA', r, [f('VERIFICADOR')], true)).toThrow(/Falta la firma de: Inlotrans/);
    expect(() => exigirFirmasPara('APROBAR', 'OBLIGATORIA', r, [f('INLOTRANS', 0), f('VERIFICADOR')], true)).toThrow(/Inlotrans/);
    expect(() => exigirFirmasPara('APROBAR', 'OBLIGATORIA', r, [f('INLOTRANS'), f('VERIFICADOR')], true)).not.toThrow();
    expect(() => exigirFirmasPara('VALIDAR', 'OBLIGATORIA', r, [], true)).toThrow(/quien recibe/);
    expect(() => exigirFirmasPara('VALIDAR', 'OBLIGATORIA', r, [f('RECIBE')], true)).not.toThrow();
  });

  it('validar firmando: registra la casilla VALIDACION en la misma transacción; en modo obligatorio no valida sin firmar', async () => {
    remisiones.agregar('r1', remision('APROBADA', { opaNombre: 'OPA', fechaAprobacion: AHORA }));
    const reloj = { ahora: () => AHORA };
    const uow = new UnidadDeTrabajoFalsa({ remisiones, firmasRemision: firmas, auditoria });
    const firmaDeRemision = new FirmaDeRemision(usuarios, new HashFalso(), huella, reloj);

    const obligatoria = new ValidarRemisionUseCase(uow, reloj, firmaDeRemision, { modo: 'OBLIGATORIA' });
    await expect(obligatoria.ejecutar({ remisionId: 'r1', validadaPorId: 'coordinador', concilidadoCon: 'María' })).rejects.toBeInstanceOf(FirmasIncompletasError);

    usuarios.agregar(usuario('validador', 'COORDINADOR_MQ', ['remision.validar']));
    const piloto = new ValidarRemisionUseCase(uow, reloj, firmaDeRemision);
    const validada = await piloto.ejecutar({
      remisionId: 'r1', validadaPorId: 'validador', concilidadoCon: 'María',
      firma: { trazo: TRAZO, contrasena: 'clave-correcta', dispositivo: null, ip: null },
    });
    expect(validada.estado).toBe('VALIDADA');
    expect(firmas.firmas).toMatchObject([{ tipo: 'VALIDACION', usuarioId: 'validador', declaracion: 'Concilié esta remisión.' }]);
  });

  it('una firma por casilla y versión; solo con la remisión entregada', async () => {
    await firmar.ejecutar(comando());
    await expect(firmar.ejecutar(comando())).rejects.toBeInstanceOf(FirmaYaRegistradaError);
    await expect(firmar.ejecutar(comando({ tipo: 'RECIBE' }))).rejects.toBeInstanceOf(FirmaFueraDeTiempoError);

    remisiones.agregar('r1', remision('BORRADOR'));
    await expect(firmar.ejecutar(comando({ tipo: 'INLOTRANS', usuarioId: 'coordinador' }))).rejects.toBeInstanceOf(FirmaFueraDeTiempoError);
  });

  it('las casillas muestran la firma vigente; una versión nueva (rectificada) deja las viejas en el historial', async () => {
    await firmar.ejecutar(comando());
    await firmar.ejecutar(comando({ tipo: 'INLOTRANS', usuarioId: 'coordinador' }));

    const v1 = await consultar.ejecutar('r1');
    expect(v1.casillas.filter((c) => c.firma).map((c) => c.tipo)).toEqual(['INLOTRANS', 'VERIFICADOR']);

    // Rectificada y entregada de nuevo como versión 2 con otra cantidad: las firmas de la v1 ya no aplican.
    remisiones.agregar('r1', remision('ENTREGADA', { version: 2, cantidadCajas: 34 }));
    const v2 = await consultar.ejecutar('r1');
    expect(v2.casillas.every((c) => c.firma === null)).toBe(true);
    expect(v2.historial.map((f) => [f.version, f.vigente])).toEqual([[1, false], [1, false]]);
    // Y se puede volver a firmar la v2.
    await expect(firmar.ejecutar(comando())).resolves.toMatchObject({ version: 2 });
  });
});
