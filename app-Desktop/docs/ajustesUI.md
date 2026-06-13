# Field Service — Despacho · Contexto de proyecto para Claude Code

## Descripción general
Aplicación SAP UI5 (Fiori Horizon, `sap_horizon` theme) para gestión y despacho de órdenes de servicio técnico en campo. Corre sobre SAP Business Application Studio (BAS). Backend OData v4 servido en `/servicio-campo/`.

---

## Stack técnico
| Capa | Tecnología |
|---|---|
| Framework UI | SAP UI5 1.120+ |
| Tema | `sap_horizon` |
| Vistas | XML Views (MVC) |
| Controladores | JavaScript (AMD con `sap.ui.define`) |
| Modelo de datos | OData v4 (`sap.ui.model.odata.v4.ODataModel`) |
| Librerías UI5 | `sap.m`, `sap.ui.layout`, `sap.uxap`, `sap.ui.core` |
| CSS custom | `css/style.css` (cargado vía manifest) |
| i18n | `i18n/i18n.properties` (español) |
| Entorno | SAP BAS, puerto 8080 |

---

## Estructura de archivos
```
/
├── manifest.json
├── index.html
├── css/
│   └── style.css
├── i18n/
│   └── i18n.properties
├── view/
│   ├── App.view.xml
│   ├── Dashboard.view.xml
│   ├── Ordenes.view.xml
│   ├── Detalle.view.xml
│   └── Crear.view.xml
└── controller/
    ├── App.controller.js
    ├── Dashboard.controller.js
    ├── Ordenes.controller.js
    ├── Detalle.controller.js
    └── Crear.controller.js
```

---

## manifest.json (resumen)
```json
{
  "sap.app": {
    "id": "fsm.desktop",
    "dataSources": {
      "mainService": { "uri": "/servicio-campo/", "type": "OData", "settings": { "odataVersion": "4.0" } }
    }
  },
  "sap.ui5": {
    "rootView": { "viewName": "fsm.desktop.view.App", "type": "XML", "id": "app" },
    "resources": { "css": [{ "uri": "css/style.css" }] },
    "dependencies": {
      "minUI5Version": "1.120.0",
      "libs": { "sap.ui.core": {}, "sap.m": {}, "sap.ui.layout": {}, "sap.uxap": {} }
    },
    "routing": {
      "config": { "routerClass": "sap.m.routing.Router", "viewType": "XML", "viewPath": "fsm.desktop.view", "controlId": "appNav", "controlAggregation": "pages" },
      "routes": [
        { "name": "dashboard", "pattern": "", "target": "dashboard" },
        { "name": "crear",     "pattern": "crear",             "target": "crear" },
        { "name": "ordenes",   "pattern": "ordenes/:filtro:",   "target": "ordenes" },
        { "name": "detalle",   "pattern": "OrdenesServicio({key})", "target": "detalle" }
      ]
    }
  }
}
```

---

## Pantallas y componentes UI5 usados

### 1. App Shell — `App.view.xml`
- Contenedor raíz: `sap.m.Page` con `customHeader` (Bar con Title + Button usuario)
- `NavContainer` id=`appNav` como contenedor de navegación
- Modelo `user` (JSONModel) con `id` y `tecnicoID`
- Controlador: `onInit`, `onAbrirLogin`, `onConfirmarLogin`, `onCancelarLogin`

```xml
<Page id="appShell" showHeader="true" enableScrolling="false" backgroundDesign="List">
  <customHeader>
    <Bar>
      <contentLeft><Title text="{i18n>appTitle}" level="H2"/></contentLeft>
      <contentRight>
        <Button icon="sap-icon://person-placeholder"
          text="{= ${user>/id} ? ${user>/id} : ${i18n>btnSinSesion} }"
          press=".onAbrirLogin"/>
      </contentRight>
    </Bar>
  </customHeader>
  <NavContainer id="appNav"/>
</Page>
```

---

### 2. Dashboard — `Dashboard.view.xml`
- Contenedor: `sap.m.Page` con `headerContent` (botones Ver órdenes + Refresh)
- Grid de tiles: `FlexBox` con `wrap="Wrap"` class `sapUiSmallMargin`
- Tiles: `GenericTile` con `frameType="OneByOne"` y `NumericContent`/`core:Icon`
- Modelo: `dash` (JSONModel) con counters: `nuevas`, `activas`, `cerradas`, `total`, `slaVencido`, `bajoMinimo`, `tecnicosDisp`
- Controlador: `onInit`, `onRefrescar`, `onVerOrdenes`, `onNuevaOrden`

**Tiles (en orden):**
| CSS class | Color | Datos | Icono UI5 | Acción |
|---|---|---|---|---|
| `kpiAdd` | Azul punteado | — | `add` | `onNuevaOrden` → navega a `/crear` |
| `kpiBlue` | Azul | `dash>/nuevas` | `create` | navega a órdenes filtro `nuevas` |
| `kpiOrange` | Naranja | `dash>/activas` | `work-history` | navega a órdenes filtro `activas` |
| `kpiGreen` | Verde | `dash>/cerradas` | `sys-enter-2` | navega a órdenes filtro `cerradas` |
| `kpiRed` | Rojo | `dash>/slaVencido` | `alert` | navega a órdenes filtro `activas` |
| `kpiAmber` | Ámbar | `dash>/bajoMinimo` | `cart` | sin acción (futuro) |
| `kpiTeal` | Teal | `dash>/tecnicosDisp` | `employee` | sin acción (futuro) |
| `kpiGrey` | Gris | `dash>/total` | `list` | navega a órdenes filtro `all` |

**Nota sobre CustomData:** Los tiles con navegación usan `app:filtro` (namespace `http://schemas.sap.com/sapui5/extension/sap.ui.core.CustomData/1`) para pasar el filtro al controlador.

```xml
<GenericTile class="sapUiTinyMargin kpiTile kpiBlue" header="{i18n>kpiNuevas}"
  frameType="OneByOne" press=".onVerOrdenes" app:filtro="nuevas">
  <tileContent>
    <TileContent unit="{i18n>unidadOrdenes}">
      <content>
        <NumericContent value="{dash>/nuevas}" valueColor="Neutral"
          icon="sap-icon://create" withMargin="false"/>
      </content>
    </TileContent>
  </tileContent>
</GenericTile>
```

---

### 3. Lista de órdenes — `Ordenes.view.xml`
- Contenedor: `sap.m.Page` con `showNavButton="true"`
- Filtros: `IconTabBar` con tabs `all / nuevas / activas / cerradas`
- Tabla: `sap.m.Table` con `growing="true"`, `growingThreshold="25"`
- Binding OData: `/OrdenesServicio` con `$expand=estado,prioridad,tecnico,cliente,tipoServicio`
- Orden: `FechaApertura` descendente
- Modelo `counts` (JSONModel): `{ all, nuevas, activas, cerradas }`
- Controlador: `onInit`, `onFiltrarEstado`, `onBuscar`, `onRefrescar`, `onAbrirOrden`, `onVolver`

**Columnas de la tabla:**
| Columna | Binding | Componente |
|---|---|---|
| Número | `{Numero}` / `{Descripcion}` | `ObjectListItem` con title+text |
| Cliente | `{cliente/Nombre}` | `Text` |
| Servicio | `{tipoServicio/Nombre}` | `Text` |
| Estado | `{estado/name}` + `formatter.estadoState` | `ObjectStatus` inverted |
| Prioridad | `{prioridad/name}` + `formatter.estadoState` | `ObjectStatus` |
| Técnico | `{tecnico/Nombre}` \|\| `sinTecnico` | `Text` |
| Compromiso SLA | `FechaCompromiso` DateTimeOffset | `Text` |

**Formatter `estadoState`:** mapea `criticidad` del OData a `sap.ui.core.ValueState` (Success/Warning/Error/None).

---

### 4. Detalle de orden — `Detalle.view.xml`
- Contenedor: `sap.m.Page` con `sap.uxap.ObjectPageLayout`
- Header: `ObjectPageDynamicHeaderTitle` con:
  - `heading`: `Title` con `{Numero}`
  - `snappedContent`: `ObjectStatus` con estado
  - `expandedContent`: `Text` con `{cliente/Nombre}`
- Header content (expandido): `ObjectStatus` para Estado, Prioridad, Técnico + `ObjectNumber` para monto EUR
- Tabs (IconTabBar dentro del ObjectPage): `Datos de la orden`, `Repuestos consumidos`, `Registros de tiempo`
- Sección Datos: `form:SimpleForm` con campos Cliente, Equipo, Tipo de Servicio, Fecha apertura, Compromiso SLA, Fecha cierre, Descripción
- Sección Repuestos: `Table` id=`tablaRepuestos`, columns: Producto/Categoría, Cantidad, Precio unit., Subtotal. Botón `+ Agregar material`
- Sección Tiempo: `Table` id=`tablaTiempos`, columns: Técnico, Fecha, Horas, Notas. Botón `+ Registrar tiempo`
- Footer buttons: `Asignar técnico`, `Iniciar`, `Cerrar orden` (Emphasized), `Reabrir orden` (Warning)
- Controlador: `onInit`, `onVolver`, `onIniciar`, `onCerrar`, `onReabrir`, `onAsignar`, `onCancelarAsignar`, `onConfirmarAsignar`, `onAgregarMaterial`, `onProductoSeleccionado`, `onConfirmarMaterial`, `onCancelarMaterial`, `onQuitarRepuesto`, `onRegistrarTiempo`, `onConfirmarTiempo`, `onCancelarTiempo`, `onQuitarTiempo`

---

### 5. Crear orden — `Crear.view.xml`
- Contenedor: `sap.m.Page` con `showNavButton="true"`
- Formulario: `form:SimpleForm` con `layout="ColumnLayout"`, `columnsM/L/XL="1"` (1 columna)
- Modelo `form` (JSONModel): `{ cliente_ID, equipo_ID, tipoServicio_ID, prioridad_code, Descripcion }`
- Campos:
  - `Select` id=`selCliente` → `/Clientes` OData, dispara `onClienteChange`
  - `ComboBox` id=`cbEquipo` → `/Equipos` OData (filtrado por cliente)
  - `Select` tipo de servicio → `/TipoServicios`
  - `Select` prioridad → `/Prioridades` (binding key=`{code}`)
  - `TextArea` descripción, `rows="3"`, `growing="true"`
- Footer: `Guardar` (Emphasized + icono save) + `Cancelar`
- Controlador: `onInit`, `onClienteChange`, `onGuardar`, `onCancelar`

---

## CSS custom — `css/style.css` (estado actual)

```css
/* Tiles KPI — bordes redondeados, hover elevation */
.kpiTile.sapMGT {
  border-radius: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border: 1px solid rgba(0,0,0,0.06);
}
.kpiTile.sapMGT:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}

/* Fondos con gradientes por categoría */
.kpiTile .sapMGTContent, .kpiTile.sapMGT { background: var(--kpiBg, transparent) !important; }
.kpiBlue   { --kpiBg: linear-gradient(135deg, #e8f1fb 0%, #d5e7f7 100%); }
.kpiOrange { --kpiBg: linear-gradient(135deg, #fdf0e3 0%, #fae3c8 100%); }
.kpiGreen  { --kpiBg: linear-gradient(135deg, #eaf6ec 0%, #d4edda 100%); }
.kpiRed    { --kpiBg: linear-gradient(135deg, #fdeaea 0%, #f9d4d4 100%); }
.kpiAmber  { --kpiBg: linear-gradient(135deg, #fef6e0 0%, #fde8b0 100%); }
.kpiTeal   { --kpiBg: linear-gradient(135deg, #e4f4f3 0%, #c8eae8 100%); }
.kpiGrey   { --kpiBg: linear-gradient(135deg, #eef1f5 0%, #dde3ec 100%); }
.kpiAdd    { --kpiBg: linear-gradient(135deg, #f0f7ff 0%, #deeefb 100%); }
.kpiAdd.sapMGT { border: 2px dashed #0a6ed1 !important; }

/* Page header azul */
.sapMPageHeader { background: linear-gradient(90deg, #0a6ed1 0%, #0854a0 100%) !important; }
.sapMPageHeader .sapMTitle { color: #ffffff !important; font-weight: 700 !important; }

/* Tabla órdenes — columnas en mayúsculas, hover azul */
.sapMListTblHeaderCell {
  font-weight: 700 !important; font-size: 0.8rem !important;
  text-transform: uppercase !important; letter-spacing: 0.04em !important;
}
.sapMListTbl tbody tr:hover { background-color: #f0f7ff !important; }

/* Número de orden en detalle */
.sapFDynamicPageTitle .sapMTitle {
  font-size: 1.5rem !important; font-weight: 800 !important; color: #0a6ed1 !important;
}

/* Labels de formulario como uppercase */
.sapUiSimpleForm .sapMLabel {
  color: #8c9199 !important; font-size: 0.75rem !important;
  font-weight: 600 !important; text-transform: uppercase !important;
}

/* Botón Cerrar orden con gradiente */
.sapMBtnEmphasized .sapMBtnInner {
  background: linear-gradient(135deg, #0a6ed1 0%, #0854a0 100%) !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 2px 6px rgba(10,110,209,0.3) !important;
}
```

---

## Entidades OData v4 principales
| Entidad | Campos relevantes |
|---|---|
| `OrdenesServicio` | `ID`, `Numero`, `Descripcion`, `FechaApertura`, `FechaCompromiso`, `FechaCierre`, `estado_code`, `prioridad_code`, `cliente_ID`, `equipo_ID`, `tipoServicio_ID`, `tecnico_ID` |
| `Clientes` | `ID`, `Nombre` |
| `Equipos` | `ID`, `Descripcion`, `cliente_ID` |
| `TipoServicios` | `ID`, `Nombre` |
| `Prioridades` | `code`, `name`, `nivel`, `criticidad` |
| `Estados` | `code`, `name`, `criticidad` |
| `Tecnicos` | `ID`, `Nombre`, `zona`, `disponible` |
| `Repuestos` (nav) | `ID`, `orden_ID`, `producto_ID`, `Cantidad`, `PrecioUnit` |
| `RegistrosTiempo` (nav) | `ID`, `orden_ID`, `tecnico_ID`, `Fecha`, `Horas`, `Notas` |
| `Productos` | `ID`, `Nombre`, `Categoria`, `PrecioUnit` |

**Expand típico en detalle:** `$expand=estado,prioridad,tecnico,cliente,tipoServicio,repuestos/producto,registrosTiempo/tecnico`

---

## Convenciones del proyecto

- **Namespace del módulo:** `fsm.desktop`
- **Vistas:** `fsm.desktop.view.<Nombre>`
- **Controladores:** `fsm.desktop.controller.<Nombre>`
- **i18n:** todas las cadenas de texto van en `i18n/i18n.properties`, sin hardcodear strings en XML
- **Formatter:** existe un módulo `formatter` (importado en controladores) con al menos `estadoState(criticidad)` que retorna `sap.ui.core.ValueState`
- **Modelos nombrados:** `i18n`, `user`, `dash`, `form`, `counts` — el modelo OData principal queda sin nombre
- **Color primario:** `#0a6ed1` (SAP Blue)
- **No usar** `sap.ui.commons` (deprecated), preferir `sap.m` y `sap.uxap`
- **CSS:** solo en `css/style.css`, usando clases propias prefijadas (`kpi*`) o sobrescribiendo clases SAP con `!important` cuando sea necesario. Respetar el tema `sap_horizon`.

---

## Mejoras de UI ya aplicadas (no duplicar)
1. ✅ Header de página con gradiente azul (`#0a6ed1 → #0854a0`)
2. ✅ Tiles KPI con gradientes de fondo y hover elevation
3. ✅ Encabezados de columna en tabla en MAYÚSCULAS
4. ✅ Hover azul claro en filas de tabla
5. ✅ Labels de formulario en uppercase/gris
6. ✅ Número de orden (`OS-xxxx`) en azul bold grande en detalle
7. ✅ Botón "Cerrar orden" con gradiente azul y sombra
8. ✅ Border radius aumentado en tiles y botones (`0.5–1rem`)
9. ✅ Contador de tabs con fondo azul sólido

---

## Pendientes / ideas para próximas mejoras
- [ ] Indicadores de color de prioridad en tabla (chip Urgente=rojo, Alta=naranja, Media=azul, Baja=gris)
- [ ] Estado vacío estilizado ("No hay órdenes") con ilustración SAP
- [ ] Responsive: adaptar el FlexBox del Dashboard a grid real en pantallas grandes
- [ ] Skeleton loading mientras carga OData
- [ ] Toast/MessageToast con más contexto al guardar/cerrar orden
- [ ] Filtro de búsqueda en tiempo real (live search en lugar de submit)
- [ ] Badge de "Urgente" en el tile SLA vencido cuando el valor > 0