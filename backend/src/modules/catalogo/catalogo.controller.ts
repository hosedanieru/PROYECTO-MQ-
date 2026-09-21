/**
 * CONTROLADOR DE CATÁLOGOS DE REFERENCIA
 * ======================================
 *
 *   GET /api/catalogos/turnos        catalogo.consultar
 *   GET /api/catalogos/lugares       catalogo.consultar
 *   GET /api/catalogos/roles         admin.usuarios
 *
 * Alimentan los selectores del frontend. Solo lectura por ahora. Los
 * grupos (antes "proveedores") tienen su controlador: `/api/grupos`.
 */

import { Controller, Get, Inject } from '@nestjs/common';

import {
  CATALOGO_REPOSITORY,
  type CatalogoRepository,
} from '../../domain/catalogo/catalogo.repository.js';
import { RequierePermisos } from '../../infrastructure/auth/decoradores.js';

@Controller('catalogos')
export class CatalogoController {
  constructor(
    @Inject(CATALOGO_REPOSITORY)
    private readonly catalogos: CatalogoRepository,
  ) {}

  @Get('turnos')
  @RequierePermisos('catalogo.consultar')
  turnos() {
    return this.catalogos.listarTurnos();
  }

  @Get('lugares')
  @RequierePermisos('catalogo.consultar')
  lugares() {
    return this.catalogos.listarLugares();
  }

  @Get('roles')
  @RequierePermisos('admin.usuarios')
  roles() {
    return this.catalogos.listarRoles();
  }
}
