
using { fsm } from '../db/schema';

/**
 * Servicio operativo de Field Service.
 * Expone el modelo de dominio como OData v4 y, vía @gavdi/cap-mcp, como
 * recursos y tools MCP para agentes de IA y automatización de procesos.
 *
 * Esta es la fachada base reutilizable por las distintas apps (despacho web,
 * almacén, app mobile del técnico). Las acciones de negocio y la lógica de
 * automatización se implementan en servicio-campo.js.
 */
@path: '/servicio-campo'
service ServicioCampoService {

  //// ───────────  Inventario  ─────────── ////

  @mcp: {
    name       : 'productos',
    description: 'Inventario de productos/repuestos con precio y stock',
    resource   : ['filter', 'orderby', 'select', 'top', 'skip']
  }
  entity Productos as projection on fsm.Productos;

  @mcp: {
    name       : 'proveedores',
    description: 'Proveedores que abastecen el inventario',
    resource   : ['filter', 'orderby', 'select', 'top', 'skip']
  }
  entity Proveedores as projection on fsm.Proveedores;

  entity PedidosCompra as projection on fsm.PedidosCompra actions {
    @mcp: {
      name       : 'pedido-recibir',
      description: 'Marca un pedido de compra como recibido e ingresa la mercancía al stock',
      tool       : true,
      elicit     : ['confirm']
    }
    action recibir() returns PedidosCompra;
  };

  entity LineasPedido as projection on fsm.LineasPedido;

  //// ───────────  Clientes y activos  ─────────── ////

  @mcp: {
    name       : 'clientes',
    description: 'Clientes a los que se presta servicio',
    resource   : ['filter', 'orderby', 'select', 'top', 'skip']
  }
  entity Clientes as projection on fsm.Clientes;

  entity Equipos as projection on fsm.Equipos;

  //// ───────────  Personal de campo  ─────────── ////

  @mcp: {
    name       : 'tecnicos',
    description: 'Técnicos de campo con su zona y disponibilidad',
    resource   : ['filter', 'orderby', 'select', 'top', 'skip']
  }
  entity Tecnicos as projection on fsm.Tecnicos;

  entity Habilidades        as projection on fsm.Habilidades;
  entity TecnicoHabilidades as projection on fsm.TecnicoHabilidades;

  //// ───────────  Servicios y órdenes  ─────────── ////

  @mcp: {
    name       : 'catalogo-servicios',
    description: 'Tipos de servicio ofrecidos con su tarifa y SLA',
    resource   : ['filter', 'orderby', 'select', 'top']
  }
  entity CatalogoServicios as projection on fsm.CatalogoServicios;

  @mcp: {
    name       : 'ordenes-servicio',
    description: 'Órdenes de servicio con su estado, prioridad y técnico asignado',
    resource   : ['filter', 'orderby', 'select', 'top', 'skip', 'expand']
  }
  entity OrdenesServicio as projection on fsm.OrdenesServicio actions {
    @mcp: {
      name       : 'orden-asignar-tecnico',
      description: 'Asigna un técnico disponible a la orden y la pasa a estado ASIGNADA',
      tool       : true
    }
    action asignar(
      tecnicoID : UUID @mcp.hint: 'ID del técnico (campo ID de Tecnicos) que tomará la orden'
    ) returns OrdenesServicio;

    @mcp: {
      name       : 'orden-iniciar',
      description: 'Marca que el técnico está en sitio y comienza el trabajo (estado EN_SITIO)',
      tool       : true
    }
    action iniciar() returns OrdenesServicio;

    @mcp: {
      name       : 'orden-cerrar',
      description: 'Cierra la orden: calcula el costo total (repuestos + mano de obra), descuenta stock y libera al técnico',
      tool       : true,
      elicit     : ['confirm']
    }
    action cerrar() returns OrdenesServicio;
  };

  entity LineasRepuesto  as projection on fsm.LineasRepuesto;
  entity RegistrosTiempo as projection on fsm.RegistrosTiempo;

  //// ───────────  Catálogos (value helps) ─────────── ////

  @readonly entity EstadosOrden           as projection on fsm.EstadosOrden;
  @readonly entity Prioridades            as projection on fsm.Prioridades;
  @readonly entity EstadosPedido          as projection on fsm.EstadosPedido;
  @readonly entity DisponibilidadTecnico  as projection on fsm.DisponibilidadTecnico;

  //// ───────────  Tools MCP (consultas) ─────────── ////

  @mcp: {
    name       : 'producto-buscar-por-categoria',
    description: 'Devuelve los productos de una categoría concreta',
    tool       : true
  }
  function productosPorCategoria(
    categoria : String @mcp.hint: 'Categoría exacta, p. ej. "Periféricos" o "Pantallas"'
  ) returns array of Productos;

  @mcp: {
    name       : 'ordenes-de-tecnico',
    description: 'Lista las órdenes activas (no cerradas ni canceladas) de un técnico',
    tool       : true
  }
  function ordenesDeTecnico(
    tecnicoID : UUID @mcp.hint: 'ID del técnico (campo ID de Tecnicos)'
  ) returns array of OrdenesServicio;

  @mcp: {
    name       : 'productos-bajo-minimo',
    description: 'Lista los productos cuyo stock está por debajo del stock mínimo',
    tool       : true
  }
  function productosBajoMinimo() returns array of Productos;

  @mcp: {
    name       : 'ordenes-sla-vencido',
    description: 'Lista las órdenes activas cuya fecha de compromiso (SLA) ya venció',
    tool       : true
  }
  function ordenesSlaVencido() returns array of OrdenesServicio;

  //// ───────────  Acciones de automatización ─────────── ////

  @mcp: {
    name       : 'generar-reposicion',
    description: 'Genera pedidos de compra en borrador para todos los productos bajo el stock mínimo, agrupados por proveedor preferido',
    tool       : true,
    elicit     : ['confirm']
  }
  action generarReposicion() returns array of PedidosCompra;
}
