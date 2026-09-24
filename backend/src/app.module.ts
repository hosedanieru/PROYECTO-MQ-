import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { RegistroPeticionesMiddleware } from './infrastructure/http/registro-peticiones.middleware.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogoModule } from './modules/catalogo/catalogo.module.js';
import { MfrModule } from './modules/mfr/mfr.module.js';
import { RemisionModule } from './modules/remision/remision.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

/**
 * Observe (APM de NestJS) solo se activa con credenciales reales. Con las
 * de relleno el worker del agente falla al autenticarse y se reinicia en
 * bucle, llenando la consola de errores en desarrollo y en las pruebas.
 * Registrarse en https://observe.nestjs.com y definir en .env:
 *   OBSERVE_APP_KEY / OBSERVE_APP_SECRET
 */
const OBSERVE_APP_KEY = process.env.OBSERVE_APP_KEY;
const OBSERVE_APP_SECRET = process.env.OBSERVE_APP_SECRET;
export const observeHabilitado = Boolean(OBSERVE_APP_KEY && OBSERVE_APP_SECRET);

const modulosOpcionales = observeHabilitado
  ? [
      ObserveModule.forRoot({
        appKey: OBSERVE_APP_KEY!,
        appSecret: OBSERVE_APP_SECRET!,
        serviceId: 'backend',
      }),
    ]
  : [];

@Module({
  // La base de datos (PostgreSQL o Firestore) la decide PersistenciaModule,
  // que importan los módulos de negocio; aquí no se conecta nada.
  imports: [
    AuthModule,
    CatalogoModule,
    RemisionModule,
    MfrModule,
    ...modulosOpcionales,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  /**
   * El registro va sobre TODAS las rutas: su valor está en ver el
   * volumen total, no el de una ruta suelta.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RegistroPeticionesMiddleware).forRoutes('*');
  }
}
