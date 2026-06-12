sap.ui.define([
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
  "use strict";

  return UIComponent.extend("fsm.desktop.Component", {
    metadata: {
      manifest: "json",
      interfaces: ["sap.ui.core.IAsyncContentCreation"]
    },

    init: function () {
      UIComponent.prototype.init.apply(this, arguments);

      // Modelo de usuario (id + isAdmin) para gating en la UI
      this.setModel(new JSONModel({ id: "", isAdmin: false }), "user");
      this._cargarUsuario();

      this.getRouter().initialize();
    },

    _cargarUsuario: function () {
      const oUserModel = this.getModel("user");
      const oOperation = this.getModel().bindContext("/whoami(...)");
      oOperation.execute().then(() => {
        const oCtx = oOperation.getBoundContext();
        oUserModel.setData({ id: oCtx.getProperty("id"), isAdmin: oCtx.getProperty("isAdmin") });
      }).catch(() => { /* sin sesión válida aún; queda isAdmin=false */ });
    }
  });
});
