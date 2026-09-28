import { beforeEach, describe, expect, it } from 'vitest';

import {
  CausalNoEncontradaError,
  CodigoCausalDuplicadoError,
  DatosCausalInvalidosError,
} from '../../domain/averia/averia.errors.js';
import { CausalRepositorioFalso } from '../pruebas/dobles-averia.js';
import { AuditoriaRepositorioFalso, UnidadDeTrabajoFalsa } from '../pruebas/dobles-en-memoria.js';
import { ActualizarCausalUseCase, CrearCausalUseCase } from './causal-averia.use-cases.js';

describe('Causales de avería — casos de uso', () => {
  let causales: CausalRepositorioFalso;
  let auditoria: AuditoriaRepositorioFalso;
  let uow: UnidadDeTrabajoFalsa;

  beforeEach(() => {
    causales = new CausalRepositorioFalso();
    auditoria = new AuditoriaRepositorioFalso();
    uow = new UnidadDeTrabajoFalsa({ causales, auditoria });
    causales.agregar({ id: 'c1', codigo: 'ESTALLADO', nombre: 'Estallado', orden: 1, activo: true });
  });

  describe('CrearCausalUseCase', () => {
    it('crea la causal normalizada y la audita', async () => {
      const creada = await new CrearCausalUseCase(uow).ejecutar({
        codigo: 'bajo_de_aire',
        nombre: ' Bajo de aire ',
        orden: 4,
        usuarioId: 'u1',
      });

      expect(creada).toMatchObject({ codigo: 'BAJO_DE_AIRE', nombre: 'Bajo de aire', orden: 4, activo: true });
      expect(auditoria.entradas).toEqual([
        expect.objectContaining({ entidad: 'causal_averia', entidadId: creada.id, accion: 'CREAR', usuarioId: 'u1' }),
      ]);
    });

    it('rechaza un código repetido sin auditar nada', async () => {
      await expect(
        new CrearCausalUseCase(uow).ejecutar({ codigo: 'estallado', nombre: 'Otra', orden: 2, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(CodigoCausalDuplicadoError);
      expect(auditoria.entradas).toHaveLength(0);
    });

    it('valida antes de abrir la transacción', async () => {
      await expect(
        new CrearCausalUseCase(uow).ejecutar({ codigo: 'X', nombre: '', orden: 0, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(DatosCausalInvalidosError);
    });
  });

  describe('ActualizarCausalUseCase', () => {
    it('cambia el nombre y desactiva, con valor anterior y nuevo en la auditoría', async () => {
      const actualizada = await new ActualizarCausalUseCase(uow).ejecutar({
        causalId: 'c1',
        cambios: { nombre: 'Estallado (bolsa)', activo: false },
        usuarioId: 'u1',
      });

      expect(actualizada).toMatchObject({ codigo: 'ESTALLADO', nombre: 'Estallado (bolsa)', activo: false });
      expect(auditoria.entradas[0]).toMatchObject({
        accion: 'ACTUALIZAR',
        valorAnterior: expect.objectContaining({ nombre: 'Estallado', activo: true }),
        valorNuevo: expect.objectContaining({ nombre: 'Estallado (bolsa)', activo: false }),
      });
    });

    it('una clave undefined no pisa el valor actual', async () => {
      const actualizada = await new ActualizarCausalUseCase(uow).ejecutar({
        causalId: 'c1',
        cambios: { nombre: undefined, orden: 7 },
        usuarioId: 'u1',
      });
      expect(actualizada).toMatchObject({ nombre: 'Estallado', orden: 7 });
    });

    it('no permite tomar el código de otra causal', async () => {
      causales.agregar({ id: 'c2', codigo: 'SOBREPESO', nombre: 'Sobrepeso', orden: 6, activo: true });
      await expect(
        new ActualizarCausalUseCase(uow).ejecutar({ causalId: 'c2', cambios: { codigo: 'ESTALLADO' }, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(CodigoCausalDuplicadoError);
    });

    it('falla si la causal no existe', async () => {
      await expect(
        new ActualizarCausalUseCase(uow).ejecutar({ causalId: 'nada', cambios: {}, usuarioId: 'u1' }),
      ).rejects.toBeInstanceOf(CausalNoEncontradaError);
    });
  });
});
