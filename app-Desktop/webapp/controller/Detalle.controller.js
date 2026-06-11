sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "fsm/desktop/model/formatter",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, formatter, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("fsm.desktop.controller.Detalle", {
    formatter: formatter,

    onInit: function () {
      this.getOwnerComponent().getRouter()
        .getRoute("detalle")
        .attachPatternMatched(this._onMatched, this);
    },

    _onMatched: function (oEvent) {
      const sKey = oEvent.getParameter("arguments").key;
      this.getView().bindElement({
        path: "/OrdenesServicio(" + sKey + ")",
        parameters: {
          $expand: "estado,prioridad,tecnico,cliente,equipo,tipoServicio"
        }
      });
    },

    onVolver: function () {
      this.getOwnerComponent().getRouter().navTo("ordenes");
    },

    // ─────────────  Acciones de la orden (bound actions OData V4)  ───────────── //

    _ejecutarAccion: function (sNombre, mParams) {
      const oCtx = this.getView().getBindingContext();
      if (!oCtx) {
        return Promise.reject(new Error("La orden aún no cargó"));
      }
      const oOperation = this.getView().getModel()
        .bindContext("ServicioCampoService." + sNombre + "(...)", oCtx);
      Object.keys(mParams || {}).forEach((sKey) => oOperation.setParameter(sKey, mParams[sKey]));
      return oOperation.execute().then(function () {
        return oCtx.refresh();
      });
    },

    _onError: function (oError) {
      const sMsg = (oError && oError.error && oError.error.message) || oError.message || String(oError);
      const sTpl = this.getView().getModel("i18n").getResourceBundle().getText("errAccion", [sMsg]);
      MessageBox.error(sTpl);
    },

    onIniciar: function () {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      this._ejecutarAccion("iniciar")
        .then(() => MessageToast.show(oBundle.getText("msgIniciada")))
        .catch(this._onError.bind(this));
    },

    onCerrar: function () {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      MessageBox.confirm(oBundle.getText("confirmCerrar"), {
        onClose: (sAction) => {
          if (sAction !== MessageBox.Action.OK) { return; }
          this._ejecutarAccion("cerrar")
            .then(() => MessageToast.show(oBundle.getText("msgCerrada")))
            .catch(this._onError.bind(this));
        }
      });
    },

    // ─────────────  Diálogo de asignación de técnico  ───────────── //

    onAsignar: function () {
      if (this._pDialog) {
        this._pDialog.then((oDialog) => oDialog.open());
        return;
      }
      this._pDialog = this.loadFragment({ name: "fsm.desktop.view.AsignarDialog" })
        .then((oDialog) => {
          this.getView().addDependent(oDialog);
          oDialog.open();
          return oDialog;
        });
    },

    onCancelarAsignar: function () {
      this._pDialog.then((oDialog) => oDialog.close());
    },

    onConfirmarAsignar: function () {
      const oBundle = this.getView().getModel("i18n").getResourceBundle();
      const oList = this.byId("listTecnicos");
      const oItem = oList && oList.getSelectedItem();
      if (!oItem) {
        MessageToast.show(oBundle.getText("selTecnico"));
        return;
      }
      const sTecnicoID = oItem.getBindingContext().getProperty("ID");
      this._ejecutarAccion("asignar", { tecnicoID: sTecnicoID })
        .then(() => {
          MessageToast.show(oBundle.getText("msgAsignada"));
          return this._pDialog.then((oDialog) => oDialog.close());
        })
        .catch(this._onError.bind(this));
    }
  });
});
