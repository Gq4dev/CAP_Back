using { sap.common.CodeList } from '@sap/cds/common';

namespace fsm;

/**
 * Catálogos de valores (code lists) del dominio Field Service.
 * Heredan de sap.common.CodeList → aportan `name` y `descr` (localizables),
 * ideales para value helps y textos en Fiori.
 * El campo `criticidad` alimenta el coloreado de criticidad en Fiori:
 *   0 = neutro · 1 = negativo (rojo) · 2 = crítico (naranja) · 3 = positivo (verde)
 */

// Ciclo de vida de una orden de servicio
entity EstadosOrden : CodeList {
  key code       : String(20);
      criticidad : Integer default 0;
}

// Prioridad de atención de una orden
entity Prioridades : CodeList {
  key code       : String(20);
      nivel      : Integer;            // orden de severidad (1 = más baja)
      criticidad : Integer default 0;
}

// Ciclo de vida de un pedido de compra
entity EstadosPedido : CodeList {
  key code       : String(20);
      criticidad : Integer default 0;
}

// Disponibilidad de un técnico
entity DisponibilidadTecnico : CodeList {
  key code       : String(20);
      criticidad : Integer default 0;
}
