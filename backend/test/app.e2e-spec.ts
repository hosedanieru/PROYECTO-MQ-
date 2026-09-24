/**
 * Comprobación de vida por HTTP.
 *
 * Verifica lo que consume el healthcheck de Docker: `GET /api` responde
 * 200 y SIN token (va marcado con `@Publico()`). Si esta prueba falla,
 * el contenedor del backend nunca pasa a `healthy` y el frontend no
 * arranca.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from './../src/app.module.js';

describe('Comprobación de vida (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET / responde sin token', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ estado: 'ok', servicio: 'mq-backend' });
  });

  afterEach(async () => {
    await app.close();
  });
});
