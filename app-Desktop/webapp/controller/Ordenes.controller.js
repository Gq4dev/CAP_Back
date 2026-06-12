sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "fsm/desktop/model/formatter",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, formatter, JSONModel, Filter, FilterOperator) {
  "use strict";

  // Estados que agrupa cada pestaña
  const TAB_ESTADOS = {
    all: [],
    nuevas: ["NUEVA"],
    activas: ["ASIGNADA", "EN_CAMINO", "EN_SITIO", "EN_ESPERA"],
    cerradas: ["CERRADA", "CANCELADA"]
  };

  return Controller.extend("fsm.desktop.controller.Ordenes", {
    formatter: formatter,

    onInit: function () {
      this.getView().setModel(new JSONModel({ all: 0, nuevas: 0, activas: 0, cerradas: 0 }), "counts");
      this._estadoFilter = null;
      this._searchFilter = null;
      // Al entrar a la lista: refrescar contadores y aplicar el filtro recibido
      this.getOwnerComponent().getRouter()
        .getRoute("ordenes")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      this._refreshCounts();
      const sFiltro = (oEvent.getParameter("arguments") || {}).filtro || "all";
      const sKey = TAB_ESTADOS[sFiltro] ? sFiltro : "all";
      this.byId("filtroEstados").setSelectedKey(sKey);
      this._filtrarPorTab(sKey);
    },

    // ─────────────  Contadores por estado (agregación OData $apply)  ───────────── //

    _refreshCounts: function () {
      const oList = this.getView().getModel().bindList("/OrdenesServicio", null, [], [], {
        $apply: "groupby((estado_code),aggregate($count as Total))"
      });
      oList.requestContexts(0, 100).then((aContexts) => {
        const mPorEstado = {};
        let iTotal = 0;
        aContexts.forEach((oCtx) => {
          const o = oCtx.getObject();
          mPorEstado[o.estado_code] = o.Total;
          iTotal += o.Total;
        });
        const fnSuma = (aCodes) => aCodes.reduce((n, c) => n + (mPorEstado[c] || 0), 0);
        this.getView().getModel("counts").setData({
          all: iTotal,
          nuevas: fnSuma(TAB_ESTADOS.nuevas),
          activas: fnSuma(TAB_ESTADOS.activas),
          cerradas: fnSuma(TAB_ESTADOS.cerradas)
        });
      });
    },

    // ─────────────  Filtros (pestaña de estado + búsqueda)  ───────────── //

    onFiltrarEstado: function (oEvent) {
      this._filtrarPorTab(oEvent.getParameter("key"));
    },

    _filtrarPorTab: function (sKey) {
      const aCodes = TAB_ESTADOS[sKey] || [];
      this._estadoFilter = aCodes.length
        ? new Filter({ filters: aCodes.map((c) => new Filter("estado_code", FilterOperator.EQ, c)), and: false })
        : null;
      this._aplicarFiltros();
    },

    onBuscar: function (oEvent) {
      const sQuery = oEvent.getParameter("query");
      this._searchFilter = sQuery
        ? new Filter({
            filters: [
              new Filter("Numero", FilterOperator.Contains, sQuery),
              new Filter("Descripcion", FilterOperator.Contains, sQuery)
            ],
            and: false
          })
        : null;
      this._aplicarFiltros();
    },

    _aplicarFiltros: function () {
      const aFilters = [this._estadoFilter, this._searchFilter].filter(Boolean);
      this.byId("tablaOrdenes").getBinding("items").filter(
        aFilters.length ? new Filter({ filters: aFilters, and: true }) : []
      );
    },

    onRefrescar: function () {
      this.byId("tablaOrdenes").getBinding("items").refresh();
      this._refreshCounts();
    },

    onAbrirOrden: function (oEvent) {
      const sId = oEvent.getSource().getBindingContext().getProperty("ID");
      this.getOwnerComponent().getRouter().navTo("detalle", { key: sId });
    },

    onVolver: function () {
      this.getOwnerComponent().getRouter().navTo("dashboard");
    }
  });
});
