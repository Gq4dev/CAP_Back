sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("fsm.desktop.controller.Dashboard", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        nuevas: 0, activas: 0, cerradas: 0, total: 0,
        slaVencido: 0, bajoMinimo: 0, tecnicosDisp: 0
      }), "dash");
      this.getOwnerComponent().getRouter()
        .getRoute("dashboard")
        .attachPatternMatched(this._loadKpis, this);
    },

    _loadKpis: function () {
      const oModel = this.getView().getModel();
      const oDash = this.getView().getModel("dash");
      const sNow = new Date().toISOString();

      // Órdenes por estado (agregación OData $apply, una sola consulta)
      const oAgg = oModel.bindList("/OrdenesServicio", null, [], [], {
        $apply: "groupby((estado_code),aggregate($count as Total))"
      });
      oAgg.requestContexts(0, 100).then((aContexts) => {
        const mPorEstado = {};
        let iTotal = 0;
        aContexts.forEach((oCtx) => {
          const o = oCtx.getObject();
          mPorEstado[o.estado_code] = o.Total;
          iTotal += o.Total;
        });
        const fnSuma = (aCodes) => aCodes.reduce((n, c) => n + (mPorEstado[c] || 0), 0);
        oDash.setProperty("/nuevas", fnSuma(["NUEVA"]));
        oDash.setProperty("/activas", fnSuma(["ASIGNADA", "EN_CAMINO", "EN_SITIO", "EN_ESPERA"]));
        oDash.setProperty("/cerradas", fnSuma(["CERRADA"]));
        oDash.setProperty("/total", iTotal);
      });

      // KPIs basados en conteo filtrado
      this._count("OrdenesServicio",
        "FechaCompromiso lt " + sNow + " and estado_code ne 'CERRADA' and estado_code ne 'CANCELADA'")
        .then((n) => oDash.setProperty("/slaVencido", n));

      this._count("Productos", "Stock lt StockMinimo")
        .then((n) => oDash.setProperty("/bajoMinimo", n));

      this._count("Tecnicos", "disponibilidad_code eq 'DISPONIBLE'")
        .then((n) => oDash.setProperty("/tecnicosDisp", n));
    },

    /** Devuelve el número de registros de una entidad que cumplen un $filter. */
    _count: function (sEntity, sFilter) {
      const oBinding = this.getView().getModel().bindList("/" + sEntity, null, [], [], {
        $count: true,
        $filter: sFilter
      });
      return oBinding.getHeaderContext().requestProperty("$count").then((v) => Number(v) || 0);
    },

    onRefrescar: function () {
      this._loadKpis();
    },

    onVerOrdenes: function (oEvent) {
      const oSource = oEvent.getSource();
      const sFiltro = (oSource.data && oSource.data("filtro")) || "all";
      this.getOwnerComponent().getRouter().navTo("ordenes", { filtro: sFiltro });
    },

    onNuevaOrden: function () {
      this.getOwnerComponent().getRouter().navTo("crear");
    }
  });
});
