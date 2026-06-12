sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "fsm/desktop/model/formatter",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, formatter, JSONModel, MessageToast, MessageBox) {
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
          $expand: "estado,prioridad,tecnico,cliente,equipo,tipoServicio",
          $select: "ID,Numero,Descripcion,FechaApertura,FechaCompromiso,FechaCierre,CostoTotal,estado_code,prioridad_code,cliente_ID,equipo_ID,tipoServicio_ID,tecnico_ID"
        }
      });
    },

    onVolver: function () {
      this.getOwnerComponent().getRouter().navTo("ordenes");
    },

    _txt: function (sKey, aArgs) {
      return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
    },

    _onError: function (oError) {
      const sMsg = (oError && oError.error && oError.error.message) || oError.message || String(oError);
      MessageBox.error(this._txt("errAccion", [sMsg]));
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

    onIniciar: function () {
      this._ejecutarAccion("iniciar")
        .then(() => MessageToast.show(this._txt("msgIniciada")))
        .catch(this._onError.bind(this));
    },

    onCerrar: function () {
      MessageBox.confirm(this._txt("confirmCerrar"), {
        onClose: (sAction) => {
          if (sAction !== MessageBox.Action.OK) { return; }
          this._ejecutarAccion("cerrar")
            .then(() => MessageToast.show(this._txt("msgCerrada")))
            .catch(this._onError.bind(this));
        }
      });
    },

    onReabrir: function () {
      MessageBox.confirm(this._txt("confirmReabrir"), {
        onClose: (sAction) => {
          if (sAction !== MessageBox.Action.OK) { return; }
          this._ejecutarAccion("reabrir")
            .then(() => MessageToast.show(this._txt("msgReabierta")))
            .catch(this._onError.bind(this));
        }
      });
    },

    // ─────────────  Asignación de técnico  ───────────── //

    onAsignar: function () {
      this._pAsignar ??= this.loadFragment({ name: "fsm.desktop.view.AsignarDialog" })
        .then((oDialog) => { this.getView().addDependent(oDialog); return oDialog; });
      this._pAsignar.then((oDialog) => oDialog.open());
    },

    onCancelarAsignar: function () {
      this._pAsignar.then((oDialog) => oDialog.close());
    },

    onConfirmarAsignar: function () {
      const oItem = this.byId("listTecnicos") && this.byId("listTecnicos").getSelectedItem();
      if (!oItem) {
        MessageToast.show(this._txt("selTecnico"));
        return;
      }
      const sTecnicoID = oItem.getBindingContext().getProperty("ID");
      this._ejecutarAccion("asignar", { tecnicoID: sTecnicoID })
        .then(() => {
          MessageToast.show(this._txt("msgAsignada"));
          return this._pAsignar.then((oDialog) => oDialog.close());
        })
        .catch(this._onError.bind(this));
    },

    // ─────────────  Materiales (líneas de repuesto)  ───────────── //

    onAgregarMaterial: function () {
      if (!this.getView().getModel("mat")) {
        this.getView().setModel(new JSONModel({ precio: 0 }), "mat");
      }
      this._pMaterial ??= this.loadFragment({ name: "fsm.desktop.view.AgregarMaterial" })
        .then((oDialog) => { this.getView().addDependent(oDialog); return oDialog; });
      this._pMaterial.then((oDialog) => {
        this.byId("selProducto").setSelectedKey("");
        this.byId("selProducto").setValueState("None");
        this.byId("inpCantidad").setValue(1);
        this.getView().getModel("mat").setProperty("/precio", 0);
        oDialog.open();
      });
    },

    onProductoSeleccionado: function (oEvent) {
      const oItem = oEvent.getParameter("selectedItem");
      const fPrecio = oItem ? Number(oItem.getBindingContext().getProperty("Precio")) : 0;
      this.getView().getModel("mat").setProperty("/precio", fPrecio);
      this.byId("selProducto").setValueState("None");
    },

    onConfirmarMaterial: function () {
      const sProducto = this.byId("selProducto").getSelectedKey();
      if (!sProducto) {
        this.byId("selProducto").setValueState("Error");
        return;
      }
      this.byId("tablaRepuestos").getBinding("items").create({
        producto_ID: sProducto,
        Cantidad: this.byId("inpCantidad").getValue(),
        PrecioUnit: this.getView().getModel("mat").getProperty("/precio")
      });
      this._pMaterial.then((oDialog) => oDialog.close());
      MessageToast.show(this._txt("msgMaterialAgregado"));
    },

    onCancelarMaterial: function () {
      this._pMaterial.then((oDialog) => oDialog.close());
    },

    onQuitarRepuesto: function (oEvent) {
      oEvent.getParameter("listItem").getBindingContext().delete()
        .then(() => MessageToast.show(this._txt("msgMaterialQuitado")))
        .catch(this._onError.bind(this));
    },

    // ─────────────  Registros de tiempo  ───────────── //

    onRegistrarTiempo: function () {
      this._pTiempo ??= this.loadFragment({ name: "fsm.desktop.view.RegistrarTiempo" })
        .then((oDialog) => { this.getView().addDependent(oDialog); return oDialog; });
      this._pTiempo.then((oDialog) => {
        const oOrden = this.getView().getBindingContext();
        this.byId("selTecnicoTiempo").setSelectedKey(oOrden ? oOrden.getProperty("tecnico_ID") || "" : "");
        this.byId("selTecnicoTiempo").setValueState("None");
        this.byId("dpFecha").setValue(new Date().toISOString().slice(0, 10));
        this.byId("inpHoras").setValue(1);
        this.byId("taNotasTiempo").setValue("");
        oDialog.open();
      });
    },

    onConfirmarTiempo: function () {
      const sTecnico = this.byId("selTecnicoTiempo").getSelectedKey();
      if (!sTecnico) {
        this.byId("selTecnicoTiempo").setValueState("Error");
        return;
      }
      this.byId("tablaTiempos").getBinding("items").create({
        tecnico_ID: sTecnico,
        Fecha: this.byId("dpFecha").getValue() || null,
        Horas: this.byId("inpHoras").getValue(),
        Notas: this.byId("taNotasTiempo").getValue()
      });
      this._pTiempo.then((oDialog) => oDialog.close());
      MessageToast.show(this._txt("msgTiempoAgregado"));
    },

    onCancelarTiempo: function () {
      this._pTiempo.then((oDialog) => oDialog.close());
    },

    onQuitarTiempo: function (oEvent) {
      oEvent.getParameter("listItem").getBindingContext().delete()
        .then(() => MessageToast.show(this._txt("msgTiempoQuitado")))
        .catch(this._onError.bind(this));
    }
  });
});
