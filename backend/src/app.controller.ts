import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Publico } from './infrastructure/auth/decoradores.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Comprobación de vida: `GET /api` responde sin token. */
  @Publico()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
