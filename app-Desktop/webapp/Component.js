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

      // Modelo de usuario (id + isAdmin + tecnicoID) para gating en la UI
      this.setModel(new JSONModel({ id: "", isAdmin: false, tecnicoID: null }), "user");
      this._pUser = this._cargarUsuario();

      // El root view se crea de forma asíncrona (IAsyncContentCreation): hay que
      // inicializar el router recién cuando el control 'appNav' ya existe. Si no,
      // la ruta inicial no encuentra el contenedor y la pantalla queda en blanco.
      this.rootControlLoaded().then(() => this.getRouter().initialize());
    },

    /** Ejecuta whoami y actualiza el modelo 'user'. Resuelve true si hay sesión. */
    _cargarUsuario: function () {
      const oUserModel = this.getModel("user");
      const oOperation = this.getModel().bindContext("/whoami(...)");
      return oOperation.execute().then(() => {
        const oCtx = oOperation.getBoundContext();
        oUserModel.setData({
          id: oCtx.getProperty("id"),
          isAdmin: oCtx.getProperty("isAdmin"),
          tecnicoID: oCtx.getProperty("tecnicoID")
        });
        return true;
      }).catch(() => {
        oUserModel.setData({ id: "", isAdmin: false, tecnicoID: null });
        return false;
      });
    },

    /** Guarda las credenciales Basic en sessionStorage y recarga la app. El
        interceptor de index.html las aplica a cada XHR desde el primer request. */
    cambiarUsuario: function (sUser, sPass) {
      try {
        window.sessionStorage.setItem("fsmAuth", "Basic " + btoa(sUser + ":" + sPass));
      } catch (e) { /* sessionStorage no disponible */ }
      window.location.reload();
    },

    /** Limpia la sesión y recarga. */
    cerrarSesion: function () {
      try { window.sessionStorage.removeItem("fsmAuth"); } catch (e) { /* noop */ }
      window.location.reload();
    }
  });
});
