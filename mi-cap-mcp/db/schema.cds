using { cuid, managed } from '@sap/cds/common';
using { fsm.EstadosOrden, fsm.Prioridades, fsm.EstadosPedido, fsm.DisponibilidadTecnico } from './code-lists';

namespace fsm;

/*
 * Modelo de dominio: Gestión de Servicios Técnicos en Campo (Field Service).
 *
 * Flujo principal:
 *   Cliente abre una solicitud → se crea una OrdenServicio → se asigna un Técnico →
 *   que viaja a sitio, consume Repuestos (Productos) y registra Tiempos → cierra la orden.
 *   Los repuestos se reponen mediante PedidosCompra a Proveedores.
 *
 * Aspectos reutilizados de @sap/cds/common:
 *   - cuid    → clave técnica UUID `ID`
 *   - managed → createdAt/By + modifiedAt/By (auditoría automática)
 */

//// ─────────────────────────  Inventario  ───────────────────────── ////

/** Productos / repuestos del inventario (clave entera = SKU legible). */
entity Productos : managed {
  key ID            : Integer                          @mcp.hint: 'SKU numérico único del producto';
      Nombre        : String(100);
      Categoria     : String(50)                       @mcp.hint: 'Familia del producto, p. ej. "Periféricos"';
      Precio        : Decimal(10, 2)                   @mcp.hint: 'Precio de venta al cliente';
      Costo         : Decimal(10, 2) @mcp.omit;        // costo interno — oculto a los agentes MCP
      Stock         : Integer                          @mcp.hint: 'Unidades disponibles en almacén';
      StockMinimo   : Integer default 0                @mcp.hint: 'Umbral de reposición automática';
      ProveedorPref : Association to Proveedores;
}

/** Proveedores que abastecen el inventario. */
entity Proveedores : cuid, managed {
  Nombre       : String(120);
  Contacto     : String(120);
  Email        : String(120);
  Telefono     : String(40);
  Calificacion : Decimal(2, 1)                         @mcp.hint: 'Calificación del proveedor de 0 a 5';
  Activo       : Boolean default true;
  pedidos      : Association to many PedidosCompra on pedidos.proveedor = $self;
}

/** Pedido de compra a un proveedor para reponer stock. */
entity PedidosCompra : cuid, managed {
  Numero    : String(20)                               @mcp.hint: 'Número legible del pedido, p. ej. "PC-2026-001"';
  proveedor : Association to Proveedores;
  estado    : Association to EstadosPedido default 'BORRADOR';
  Fecha     : Date;
  Total     : Decimal(12, 2);                          // calculado a partir de las líneas
  lineas    : Composition of many LineasPedido on lineas.pedido = $self;
}

entity LineasPedido : cuid {
  pedido     : Association to PedidosCompra;
  producto   : Association to Productos;
  Cantidad   : Integer;
  PrecioUnit : Decimal(10, 2);
}

//// ───────────────────────  Clientes y activos  ─────────────────── ////

/** Clientes a los que se les presta servicio. */
entity Clientes : cuid, managed {
  Nombre    : String(120);
  Email     : String(120);
  Telefono  : String(40);
  Direccion : String(200);
  equipos   : Composition of many Equipos on equipos.cliente = $self;
  ordenes   : Association to many OrdenesServicio on ordenes.cliente = $self;
}

/** Equipos / activos instalados en sitio de cliente que reciben mantenimiento. */
entity Equipos : cuid, managed {
  Descripcion      : String(150);
  NumeroSerie      : String(60);
  cliente          : Association to Clientes;
  Ubicacion        : String(200);
  FechaInstalacion : Date;
}

//// ───────────────────────  Personal de campo  ─────────────────── ////

/** Técnicos (empleados) que ejecutan las órdenes de servicio. */
entity Tecnicos : cuid, managed {
  Nombre         : String(120);
  Email          : String(120);
  Telefono       : String(40);
  Zona           : String(60)                          @mcp.hint: 'Zona geográfica de cobertura del técnico';
  disponibilidad : Association to DisponibilidadTecnico default 'DISPONIBLE';
  habilidades    : Composition of many TecnicoHabilidades on habilidades.tecnico = $self;
  ordenes        : Association to many OrdenesServicio on ordenes.tecnico = $self;
}

/** Catálogo de habilidades / certificaciones. */
entity Habilidades : cuid {
  Nombre      : String(80);
  Descripcion : String(200);
}

/** Relación técnico↔habilidad con nivel de dominio (1-5). */
entity TecnicoHabilidades : cuid {
  tecnico   : Association to Tecnicos;
  habilidad : Association to Habilidades;
  nivel     : Integer                                  @mcp.hint: 'Nivel de dominio de 1 (básico) a 5 (experto)';
}

//// ──────────────────────  Servicios y órdenes  ────────────────── ////

/** Catálogo de tipos de servicio ofrecidos (define tarifa y SLA). */
entity CatalogoServicios : cuid, managed {
  Nombre      : String(120);
  Descripcion : String(300);
  Categoria   : String(60);
  TarifaHora  : Decimal(10, 2)                         @mcp.hint: 'Tarifa por hora facturable del servicio';
  SlaHoras    : Integer                                @mcp.hint: 'Horas de compromiso (SLA) desde la apertura';
  Activo      : Boolean default true;
}

/** Orden de servicio: unidad operativa central del dominio. */
entity OrdenesServicio : cuid, managed {
  Numero          : String(20)                         @mcp.hint: 'Número legible de la orden, p. ej. "OS-2026-001"';
  cliente         : Association to Clientes;
  equipo          : Association to Equipos;
  tipoServicio    : Association to CatalogoServicios;
  tecnico         : Association to Tecnicos;
  estado          : Association to EstadosOrden default 'NUEVA';
  prioridad       : Association to Prioridades default 'MEDIA';
  Descripcion     : String(500);
  FechaApertura   : Timestamp;
  FechaCompromiso : Timestamp                          @mcp.hint: 'Fecha límite según el SLA del tipo de servicio';
  FechaCierre     : Timestamp;
  CostoTotal      : Decimal(12, 2);                    // calculado (repuestos + mano de obra)
  repuestos       : Composition of many LineasRepuesto on repuestos.orden = $self;
  tiempos         : Composition of many RegistrosTiempo on tiempos.orden = $self;
}

/** Repuestos consumidos en una orden (descuentan stock al confirmarse). */
entity LineasRepuesto : cuid {
  orden      : Association to OrdenesServicio;
  producto   : Association to Productos;
  Cantidad   : Integer;
  PrecioUnit : Decimal(10, 2);
  Subtotal   : Decimal(12, 2) = Cantidad * PrecioUnit;  // calculado on-read
}

/** Registro de horas trabajadas por un técnico en una orden. */
entity RegistrosTiempo : cuid {
  orden   : Association to OrdenesServicio;
  tecnico : Association to Tecnicos;
  Fecha   : Date;
  Horas   : Decimal(4, 2);
  Notas   : String(300);
}
