using { ServicioCampoService } from './servicio-campo';

/*
 * Capa de autorización del servicio.
 *
 * Estado actual (desarrollo): todo el servicio requiere usuario autenticado,
 * y las acciones de negocio están abiertas a cualquier usuario autenticado
 * para no frenar el desarrollo de la UI.
 *
 * El control granular por rol (Despachador, Tecnico, Almacen, Manager) queda
 * definido en xs-security.json y se reactivará más adelante, junto con el
 * ocultamiento/inhabilitado de botones por rol en el frontend. Para volver a
 * activarlo, descomentar los bloques `@(requires: [...])` de abajo.
 */

// Todo el servicio requiere usuario autenticado
annotate ServicioCampoService with @requires: 'authenticated-user';

// Reabrir una orden es exclusivo de administradores (rol Manager)
annotate ServicioCampoService.OrdenesServicio with actions {
  reabrir @(requires: 'Manager');
};

// --- RBAC granular (desactivado por ahora) ---
// annotate ServicioCampoService.OrdenesServicio with actions {
//   asignar @(requires: ['Despachador', 'Manager']);
//   iniciar @(requires: ['Tecnico', 'Manager']);
//   cerrar  @(requires: ['Tecnico', 'Manager']);
// };
// annotate ServicioCampoService.PedidosCompra with actions {
//   recibir @(requires: ['Almacen', 'Manager']);
// };
// annotate ServicioCampoService.generarReposicion with @requires: ['Almacen', 'Manager'];
