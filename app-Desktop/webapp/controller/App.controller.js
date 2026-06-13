sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("fsm.desktop.controller.App", {

    onInit: function () {
      this.getView().setModel(new JSONModel({ usuario: "", password: "" }), "login");

      // Si al arrancar no hay sesión válida, abrir el diálogo de login.
      const oComp = this.getOwnerComponent();
      (oComp._pUser || Promise.resolve(false)).then((bAutenticado) => {
        if (!bAutenticado) { this.onAbrirLogin(); }
      });
    },

    onAbrirLogin: function () {
      this._pLogin ??= this.loadFragment({ name: "fsm.desktop.view.Login" });
      this._pLogin.then((oDialog) => {
        this.getView().getModel("login").setData({ usuario: "", password: "" });
        oDialog.open();
      });
    },

    onConfirmarLogin: function () {
      const oData = this.getView().getModel("login").getData();
      const sUser = (oData.usuario || "").trim();
      if (!sUser) { return; }
      // Guarda credenciales y recarga: el interceptor de index.html aplica el
      // header Authorization en todas las peticiones desde el primer request.
      this.getOwnerComponent().cambiarUsuario(sUser, oData.password || "");
    },

    onCancelarLogin: function () {
      this._pLogin.then((oDialog) => oDialog.close());
    }
  });
});
