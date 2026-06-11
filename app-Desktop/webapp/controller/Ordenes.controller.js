sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "fsm/desktop/model/formatter",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, formatter, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("fsm.desktop.controller.Ordenes", {
    formatter: formatter,

    onAbrirOrden: function (oEvent) {
      const oCtx = oEvent.getSource().getBindingContext();
      const sId = oCtx.getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("detalle", { key: sId });
    },

    onBuscar: function (oEvent) {
      const sQuery = oEvent.getParameter("query");
      const aFilters = sQuery
        ? [new Filter({
            filters: [
              new Filter("Numero", FilterOperator.Contains, sQuery),
              new Filter("Descripcion", FilterOperator.Contains, sQuery)
            ],
            and: false
          })]
        : [];
      this.byId("tablaOrdenes").getBinding("items").filter(aFilters);
    },

    onRefrescar: function () {
      this.byId("tablaOrdenes").getBinding("items").refresh();
    }
  });
});
