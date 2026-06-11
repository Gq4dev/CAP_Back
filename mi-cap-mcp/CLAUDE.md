# CLAUDE.md — mi-cap-mcp

Guía para trabajar en este proyecto como **ingeniero de software SAP CAP**, siguiendo
best-practices de CAP y del plugin de MCP. Trabajá siempre desde este directorio
(`mi-cap-mcp/`), que es donde vive el `package.json` y la app CAP.

## Resumen del proyecto

Backend **SAP CAP** (Node.js) para el dominio **Gestión de Servicios Técnicos en Campo
(Field Service)**, pensado como base reutilizable por varias apps (despacho web, almacén,
app mobile del técnico) y por automatización de procesos. Expone el modelo de negocio
como OData v4 y, vía el plugin `@gavdi/cap-mcp`, como **recursos** y **tools** del
**Model Context Protocol (MCP)** para agentes de IA. El plugin escanea las anotaciones
`@mcp` de los servicios y genera automáticamente el servidor MCP.

- Endpoint MCP: `http://localhost:4004/mcp`
- Health check: `http://localhost:4004/mcp/health`
- Servicio OData: `/servicio-campo` (`ServicioCampoService`)

## Stack técnico

- **SAP CAP** (`@sap/cds` ^9.9.1) — runtime Node.js (no Java).
- **Express** ^5.2.1.
- **`@cap-js/sqlite`** ^2.4.0 — base de datos **SQLite in-memory** (`:memory:`, no persiste).
- **`@gavdi/cap-mcp`** ^1.6.0 — plugin que convierte el servicio CAP en servidor MCP.
- **JavaScript puro** — no hay TypeScript. Sin linter ni tests configurados todavía.

## Estructura

```
mi-cap-mcp/
├── db/
│   ├── schema.cds              # modelo de dominio (namespace fsm)
│   ├── code-lists.cds          # catálogos: EstadosOrden, Prioridades, etc.
│   └── data/
│       └── fsm-*.csv           # seed data (<namespace>-<Entidad>.csv)
├── srv/
│   ├── servicio-campo.cds      # ServicioCampoService: entidades + acciones + @mcp
│   ├── servicio-campo.js       # handlers/lógica de negocio (cds.service.impl)
│   └── server.js               # bootstrap (cds.on('served'))
├── manifest.yml                # deploy Cloud Foundry (1 instancia)
└── package.json                # deps + bloque cds (db, mcp)
```

## Modelo de dominio (namespace `fsm`)

Flujo: el cliente abre una solicitud → se crea una **OrdenServicio** → se asigna un
**Técnico** → que va a sitio, consume **Repuestos** (Productos) y registra **Tiempos** →
cierra la orden. Los repuestos se reponen mediante **PedidosCompra** a **Proveedores**.

- **Inventario**: `Productos` (repuestos), `Proveedores`, `PedidosCompra` + `LineasPedido`.
- **Clientes/activos**: `Clientes`, `Equipos`.
- **Personal**: `Tecnicos`, `Habilidades`, `TecnicoHabilidades`.
- **Servicios/órdenes**: `CatalogoServicios`, `OrdenesServicio` + `LineasRepuesto` + `RegistrosTiempo`.
- **Catálogos** (`code-lists.cds`, value helps + criticidad Fiori): `EstadosOrden`,
  `Prioridades`, `EstadosPedido`, `DisponibilidadTecnico`.

Convenciones del modelo: aspectos `cuid` (clave UUID) + `managed` (auditoría) de
`@sap/cds/common`; estados como asociaciones a code lists (`estado_code`, etc.) con
`default`; `@mcp.omit` en campos internos (p. ej. `Productos.Costo`); `@mcp.hint` en
campos/parámetros clave. `Productos` conserva clave **entera** (SKU) por continuidad.

## Acciones de negocio y automatización (en `servicio-campo.js`)

Toda mutación de estado pasa por acciones con lógica, no por UPDATE directos:

- **`OrdenesServicio.asignar(tecnicoID)`** — valida disponibilidad del técnico,
  estado `→ASIGNADA`, marca al técnico `OCUPADO`.
- **`OrdenesServicio.iniciar()`** — estado `→EN_SITIO`.
- **`OrdenesServicio.cerrar()`** — calcula `CostoTotal` (repuestos + horas×tarifa),
  descuenta stock, estado `→CERRADA`, libera al técnico (`DISPONIBLE`). `elicit: confirm`.
- **`PedidosCompra.recibir()`** — ingresa la mercancía al stock, estado `→RECIBIDO`. `elicit: confirm`.
- **`generarReposicion()`** (servicio) — crea pedidos borrador para productos bajo mínimo,
  agrupados por proveedor preferido. `elicit: confirm`.
- **`before CREATE OrdenesServicio`** — asigna `Numero` (OS-AAAA-NNN) y `FechaCompromiso`
  desde el SLA del tipo de servicio.
- Tools de consulta: `productosPorCategoria`, `ordenesDeTecnico`, `productosBajoMinimo`,
  `ordenesSlaVencido`.

> Al añadir lógica que cambie estados, hacelo como acción/handler aquí (con su anotación
> `@mcp` en el `.cds`), no como UPDATE crudo desde el cliente.

## Backend headless: consumo externo y seguridad

Este proyecto es un **backend headless** (sin carpeta `app/`). Las UIs (Fiori freestyle,
mobile) y la automatización de procesos viven en **proyectos separados** que consumen el
servicio. No agregar UI aquí.

**Autorización** ([srv/security.cds](srv/security.cds)) — roles del dominio:
`Despachador`, `Tecnico`, `Almacen`, `Manager`. Todo el servicio requiere usuario
autenticado; las acciones que mutan estado están restringidas por rol. Lectura/consulta:
cualquier usuario autenticado.

- **Dev**: auth `mocked` con usuarios en `package.json` (`despacho`, `tecnico`, `almacen`,
  `manager`; password = el mismo nombre). Probar con Basic Auth, p. ej.
  `curl -u manager:manager http://localhost:4004/servicio-campo/Productos`.
- **Producción**: auth `xsuaa` con [xs-security.json](xs-security.json) (scopes +
  role-templates + role-collections). Requiere binding a una instancia XSUAA en BTP.

**CORS** ([srv/server.js](srv/server.js)) — habilitado en el bootstrap. En dev refleja el
`Origin` del request; en producción restringir con la variable `CORS_ORIGIN`
(orígenes permitidos separados por comas).

**Contrato OData para los frontends** — el EDMX publicado está en
[api/ServicioCampoService.edmx](api/ServicioCampoService.edmx). Un proyecto frontend lo
importa con:

```bash
cds import ../mi-cap-mcp/api/ServicioCampoService.edmx --as cds
# o desde el servicio en vivo:
cds import http://localhost:4004/servicio-campo/\$metadata --as cds
```

Regenerar el EDMX tras cambios del servicio:

```bash
node -e "const cds=require('@sap/cds');const fs=require('fs');cds.load('*').then(m=>fs.writeFileSync('api/ServicioCampoService.edmx',cds.compile.to.edmx(cds.linked(m),{service:'ServicioCampoService'})))"
```

## Comandos

```bash
npm start                              # cds-serve — arranca el servidor (prod)
npx cds watch                          # desarrollo con recarga en caliente (recomendado)
curl http://localhost:4004/mcp/health  # comprobar que el MCP está vivo
npx @modelcontextprotocol/inspector    # inspector MCP — conectar a /mcp y probar tools/recursos
cf push                                # deploy a Cloud Foundry usando manifest.yml
```

> En desarrollo, `cds watch` despliega el schema y carga el CSV automáticamente a la
> SQLite in-memory. No hace falta `cds deploy` manual.

## Best-practices CAP

- **Separación de capas**: el modelo de datos vive en `db/`, los servicios (proyecciones)
  en `srv/`, y la lógica de negocio en handlers `.js` con `cds.service.impl`.
- **Servicios como proyecciones**: definí los servicios como `projection on` sobre las
  entidades de `db/`. No dupliques el modelo en la capa de servicio.
- **CQL en handlers**: usá `SELECT` / `INSERT` / `UPDATE` / `DELETE` de CDS-QL. Accedé a
  las entidades con `const { Productos } = this.entities`. Tomá la entrada de `req.data`
  y reportá errores con `req.error(code, msg)` / `req.reject`.
- **Autorización y validación**: aplicá `@readonly`, `@requires` y `@restrict` a nivel
  de servicio/entidad. Validá la entrada antes de tocar la base.
- **Seed data**: los datos de prueba van como CSV en `db/data/` con el nombre
  `<namespace>-<Entidad>.csv` (p. ej. `miapp-Productos.csv`).
- **Nombres**: el dominio de este proyecto está en **español** (entidades, campos,
  comentarios). Mantené la coherencia.

## MCP de SAP con `@gavdi/cap-mcp`

El plugin genera el servidor MCP a partir de anotaciones `@mcp` en los `.cds`.
**Usá la forma estructurada `@mcp: { … }`** (sintaxis recomendada en v1.6.0), no las
anotaciones sueltas. El archivo actual `srv/product-service.cds` aún usa la forma suelta
(`@mcp.name`, `@mcp.resource: true`); al editarlo, migralo a la forma estructurada.

### Recurso — entidad consultable con OData v4

```cds
@readonly
@mcp: {
  name       : 'productos',
  description: 'Lista de productos con precio y stock',
  resource   : ['filter', 'orderby', 'select', 'top', 'skip']
}
entity Productos as projection on miapp.Productos;
```

- `resource: [...]` → habilita esas opciones OData (`$filter`, `$orderby`, `$select`, `$top`, `$skip`, `$expand`).
- `resource: true` → todas las opciones.
- `resource: []` → lista estática (top 100), sin query dinámica.

> Para datasets grandes, restringí las opciones (p. ej. `['top']`) en vez de `true`.

### Tool — función/acción ejecutable

```cds
@mcp: {
  name       : 'producto-buscar-por-categoria',
  description: 'Devuelve los productos de una categoría concreta',
  tool       : true
}
function productosPorCategoria(
  categoria : String @mcp.hint: 'Categoría exacta, p. ej. "Periféricos"'
) returns array of Productos;
```

La lógica se implementa en el handler:

```js
this.on('productosPorCategoria', async (req) => {
  const { categoria } = req.data;
  return SELECT.from(Productos).where({ Categoria: categoria });
});
```

### Anotaciones útiles

- **`@mcp.hint`** — descripción a nivel de campo o parámetro para guiar al agente.
  Sé específico e incluí restricciones/ejemplos; no repitas lo obvio del nombre/tipo.
- **`@mcp.omit`** — oculta un campo sensible de **todas** las respuestas MCP
  (sigue siendo aceptado como input en create/update). Útil para precios de costo,
  datos personales, notas internas.
- **`elicit: ['input', 'confirm']`** — en un tool, pide al usuario los parámetros y/o una
  confirmación antes de ejecutar. Solo para tools directos, no para wrappers de entidad.
- **`@mcp.wrap: { tools: true, modes: ['query','get','create','update'], hint: '…' }`** —
  expone una entidad como tools (no solo recurso), generando tools tipo
  `ProductService_Productos_query`, `_get`, `_create`, `_update`.
- **`@mcp.prompts`** — plantillas de prompt reutilizables a nivel de servicio.

### Configuración del plugin (`package.json` → `cds.mcp`)

```json
"cds": {
  "mcp": {
    "name": "mi-cap-mcp",
    "auth": "inherit",
    "instructions": "Instrucciones para los agentes MCP"
  }
}
```

- **`auth: "inherit"`** (default) → hereda la autenticación de CAP (XSUAA, etc.).
  **Úsalo en producción.**
- **`auth: "none"`** → sin autenticación. **Solo en local/desarrollo.** Nunca en prod.
- Para depurar el MCP: `cds.log.levels.mcp = "debug"`.

## Restricciones operativas

- **`instances: 1` es obligatorio** (ver `manifest.yml`). Las sesiones MCP viven en la
  memoria de un único proceso; con varias instancias el balanceador devuelve `-32001`.
  No escalar horizontalmente.
- **SQLite `:memory:` no persiste**: los datos se recargan desde el CSV en cada arranque.

## Convenciones

- Dominio y comentarios en **español**.
- Nombres de tools/recursos MCP en **kebab-case** (`producto-buscar-por-categoria`).
- `@mcp.description` claro y orientado al agente: explica *qué hace* y *cuándo usarlo*.

## Verificación de cambios (end-to-end)

1. `npx cds watch` desde `mi-cap-mcp/`.
2. `curl http://localhost:4004/mcp/health` → debe responder `healthy`.
3. `npx @modelcontextprotocol/inspector`, conectar a `http://localhost:4004/mcp` y
   confirmar que los recursos/tools nuevos aparecen y responden (p. ej. una query OData
   sobre `productos` o una llamada a `producto-buscar-por-categoria`).
