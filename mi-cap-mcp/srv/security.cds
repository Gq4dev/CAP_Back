using { ServicioCampoService } from './servicio-campo';

/*
 * Capa de autorización del servicio (contrato de roles).
 * Roles del dominio: Despachador, Tecnico, Almacen, Manager.
 *
 * - Lectura/consulta: cualquier usuario autenticado.
 * - Acciones que mutan estado: restringidas al rol responsable del proceso.
 *
 * En dev los roles se prueban con los usuarios mockeados de package.json
 * (despacho/tecnico/almacen/manager). En producción se mapean a scopes XSUAA
 * vía xs-security.json.
 */

// Todo el servicio requiere usuario autenticado
annotate ServicioCampoService with @requires: 'authenticated-user';

// Acciones sobre la orden de servicio
annotate ServicioCampoService.OrdenesServicio with actions {
  asignar @(requires: ['Despachador', 'Manager']);
  iniciar @(requires: ['Tecnico', 'Manager']);
  cerrar  @(requires: ['Tecnico', 'Manager']);
};

// Recepción de mercancía
annotate ServicioCampoService.PedidosCompra with actions {
  recibir @(requires: ['Almacen', 'Manager']);
};

// Reposición automática de inventario
annotate ServicioCampoService.generarReposicion with @requires: ['Almacen', 'Manager'];
