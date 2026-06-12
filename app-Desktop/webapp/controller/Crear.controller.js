sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  const DEFECTOS = { cliente_ID: null, equipo_ID: null, tipoServicio_ID: null, prioridad_code: "MEDIA", Descripcion: "" };

  return Controller.extend("fsm.desktop.controller.Crear", {

    onInit: function () {
      this.getView().setModel(new JSONModel(Object.assign({}, DEFECTOS)), "form");
      this.getOwnerComponent().getRouter()
        .getRoute("crear")
        .attachPatternMatched(this._reset, this);
    },

    /** Reinicia el formulario cada vez que se entra a la pantalla. */
    _reset: function () {
      this.getView().getModel("form").setData(Object.assign({}, DEFECTOS));
      ["selCliente", "selServicio", "taDesc"].forEach((sId) => this.byId(sId).setValueState("None"));
      const oEquipos = this.byId("cbEquipo").getBinding("items");
      if (oEquipos) { oEquipos.filter([]); }
    },

    /** Filtra los equipos por el cliente elegido (dropdown dependiente). */
    onClienteChange: function () {
      const sCliente = this.byId("selCliente").getSelectedKey();
      this.byId("cbEquipo").getBinding("items")
        .filter(sCliente ? new Filter("cliente_ID", FilterOperator.EQ, sCliente) : []);
      this.getView().getModel("form").setProperty("/equipo_ID", null);
      this.byId("cbEquipo").setSelectedKey(null);
      this.byId("selCliente").setValueState("None");
    },

    _validar: function () {
      const o = this.getView().getModel("form").getData();
      let bOk = true;
      const fnCheck = (sId, bInvalid) => {
        this.byId(sId).setValueState(bInvalid ? "Error" : "None");
        if (bInvalid) { bOk = false; }
      };
      fnCheck("selCliente", !o.cliente_ID);
      fnCheck("selServicio", !o.tipoServicio_ID);
      fnCheck("taDesc", !o.Descripcion || !o.Descripcion.trim());
      if (!bOk) {
        MessageToast.show(this._txt("camposReq"));
      }
      return bOk;
    },

    onGuardar: function () {
      if (!this._validar()) { return; }
      const o = this.getView().getModel("form").getData();
      const oListBinding = this.getView().getModel().bindList("/OrdenesServicio");
      const oContext = oListBinding.create({
        cliente_ID: o.cliente_ID,
        equipo_ID: o.equipo_ID || null,
        tipoServicio_ID: o.tipoServicio_ID,
        prioridad_code: o.prioridad_code,
        Descripcion: o.Descripcion
      });
      this._oCreateBinding = oListBinding; // mantener referencia hasta que resuelva

      oContext.created()
        .then(() => {
          MessageToast.show(this._txt("msgCreada", [oContext.getProperty("Numero")]));
          this.getOwnerComponent().getRouter().navTo("detalle", { key: oContext.getProperty("ID") });
        })
        .catch((oError) => {
          const sMsg = (oError && oError.error && oError.error.message) || oError.message || String(oError);
          MessageBox.error(this._txt("errCrear", [sMsg]));
        });
    },

    onCancelar: function () {
      this.getOwnerComponent().getRouter().navTo("dashboard");
    },

    _txt: function (sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    }
  });
});
