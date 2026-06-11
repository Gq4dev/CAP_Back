---
name: sapui5-freestyle
description: Best-practices de SAPUI5 freestyle (OData V4, MVC, fragments, i18n, bound actions, routing) para las apps frontend de este proyecto (app-Desktop y futuras). Usar al crear o modificar código UI5/Fiori freestyle que consume el backend CAP headless.
---

# SAPUI5 Freestyle — Best Practices

Guía para construir apps **SAPUI5 freestyle** que consumen el backend CAP headless
(`mi-cap-mcp`, servicio OData v4 en `/servicio-campo`). Aplica a `app-Desktop` y a
cualquier app frontend nueva del repo.

## Arquitectura y estructura

- Una app = un proyecto separado (hermano de `mi-cap-mcp/`). **No** meter UI dentro del
  backend: este se mantiene headless y reutilizable.
- Estructura estándar:
  ```
  app-<nombre>/
  ├── package.json        # scripts ui5 serve / ui5 build
  ├── ui5.yaml            # framework OpenUI5 + fiori-tools-proxy al backend
  └── webapp/
      ├── index.html      # bootstrap (ComponentSupport)
      ├── Component.js     # UIComponent, IAsyncContentCreation
      ├── manifest.json   # descriptor: dataSources, models, routing
      ├── i18n/i18n.properties
      ├── model/formatter.js
      ├── controller/*.controller.js
      └── view/*.view.xml + *.fragment.xml
  ```
- Namespace UI5 en notación de puntos (`fsm.desktop`) mapeado en `index.html` con
  `data-sap-ui-resource-roots`.

## manifest.json es el descriptor central

- Declarar el servicio en `sap.app.dataSources` con `odataVersion: "4.0"` y **URI relativa**
  (`/servicio-campo/`) — el proxy de dev la resuelve; en prod la sirve el approuter. Nunca
  hardcodear `http://localhost:4004` en el código.
- Modelo por defecto `""` de tipo `sap.ui.model.odata.v4.ODataModel` con
  `operationMode: "Server"`, `autoExpandSelect: true`, `groupId: "$auto"`.
- Routing y targets en `sap.ui5.routing` (no instanciar vistas a mano). `controlId` apunta
  al `sap.m.App`/`NavContainer` del rootView; `controlAggregation: "pages"`.
- `minUI5Version` y `libs` declaradas explícitamente.

## OData V4 — consumo

- **Bindings declarativos** en la vista; acotar datos con `$expand`/`$select` en
  `parameters` del binding (p. ej. expandir solo `estado,prioridad,tecnico,cliente`).
- Tablas con `growing="true"` + `growingThreshold` para paginación server-side.
- Filtros/ordenamiento con `sap.ui.model.Filter` / `Sorter` aplicados al binding
  (`getBinding("items").filter([...])`), no filtrando en cliente.
- **Bound actions** (asignar/iniciar/cerrar/recibir): invocar con
  ```js
  const oOp = oModel.bindContext("ServicioCampoService.<accion>(...)", oCtx);
  oOp.setParameter("nombreParam", valor);   // si la acción tiene parámetros
  await oOp.execute();
  oCtx.refresh();                            // re-leer la entidad afectada
  ```
- **Unbound actions/functions** del servicio (p. ej. `generarReposicion`): `bindContext`
  sobre el contexto raíz `/`.

## MVC y código

- Vistas **XML** declarativas; **cero lógica** en la vista. Controladores delgados.
- Siempre `sap.ui.define([...], factory)`. Prohibido: variables globales,
  `sap.ui.getCore().byId`, acceso directo al DOM. Usar `this.byId(...)`.
- IDs estables y explícitos en controles que se referencian desde el controlador.
- Navegación vía router: `this.getOwnerComponent().getRouter().navTo("ruta", { key })`.
  La clave de una entidad UUID va como predicado bare: `/OrdenesServicio(<uuid>)`.

## Textos, formato y estado

- **Todo texto visible va en `i18n/i18n.properties`** (incluidos títulos, labels, mensajes,
  textos de botones). Nunca strings hardcodeados en vistas/controladores.
- **Formatters** en `model/formatter.js`, expuestos como miembro `formatter` del controlador
  y referenciados como `{ path: '...', formatter: '.formatter.<fn>' }`. Ejemplo del repo:
  mapear `criticidad` de una code list a `ValueState` para `ObjectStatus`.
- Usar tipos OData de UI5 para formato/validación de fechas y decimales
  (`sap.ui.model.odata.type.DateTimeOffset`, `...type.Decimal`), no formateo manual.
- Expression binding (`{= ... }`) solo para lógica trivial de presentación (p. ej.
  fallback `${tecnico/Nombre} || ${i18n>sinTecnico}`); lógica real → formatter.

## Diálogos / Fragments

- Diálogos en `*.fragment.xml`, cargados perezosamente y cacheados:
  ```js
  this._pDialog ??= this.loadFragment({ name: "fsm.desktop.view.AsignarDialog" })
    .then(d => { this.getView().addDependent(d); return d; });
  ```
- `addDependent` para heredar modelos (incluido `i18n`) y ciclo de vida de la vista.

## Mensajes y errores

- Éxito breve → `sap.m.MessageToast`. Confirmaciones / errores → `sap.m.MessageBox`.
- Acciones destructivas o con efectos (cerrar orden, generar reposición) → confirmar con
  `MessageBox.confirm` antes de ejecutar.
- Capturar el rechazo de `execute()` y mostrar el mensaje del backend
  (`oError.error?.message`).

## Desarrollo local

- Dos procesos: backend `cds watch` (`:4004`) + app `ui5 serve` (`:8080`).
- El proxy `fiori-tools-proxy` (en `ui5.yaml`) enruta `/servicio-campo` al backend y
  reenvía el header `Authorization`. Auth `mocked`: loguearse con un usuario mock
  (p. ej. `manager`/`manager`) por rol.
- Validar el proyecto sin browser con `ui5 build --clean-dest` (compila manifest, vistas,
  rutas y genera el Component-preload).

## Rendimiento y calidad

- Pedir solo los campos necesarios (`autoExpandSelect` + `$select` implícito por los
  bindings); evitar `$expand` innecesarios o anidados profundos.
- `async: true` en bootstrap, rootView, routing y Component (`IAsyncContentCreation`).
- Considerar tests con QUnit (unitarios de formatters/controllers) y OPA5 (flujos),
  y lint con ESLint (`@sap/eslint-plugin-ui5-jsdocs` / reglas UI5) al madurar la app.
