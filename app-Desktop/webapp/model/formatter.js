sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Mapea la criticidad del estado (code list) a un ValueState de UI5
     * para colorear el ObjectStatus: 1=Error, 2=Warning, 3=Success, 0=None.
     */
    estadoState: function (iCriticidad) {
      switch (iCriticidad) {
        case 1: return "Error";
        case 2: return "Warning";
        case 3: return "Success";
        default: return "None";
      }
    },

    /** Texto de técnico o "Sin asignar" si la orden no tiene técnico. */
    tecnicoNombre: function (sNombre) {
      return sNombre || this.getView().getModel("i18n").getResourceBundle().getText("sinTecnico");
    }
  };
});
