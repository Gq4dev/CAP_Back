const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const {
    Productos, Tecnicos, CatalogoServicios,
    OrdenesServicio, LineasRepuesto, RegistrosTiempo,
    PedidosCompra, LineasPedido,
  } = this.entities;

  const ahora = () => new Date().toISOString();
  const hoy = () => new Date().toISOString().slice(0, 10);
  const año = () => new Date().getFullYear();
  const ESTADOS_CERRADOS = ['CERRADA', 'CANCELADA'];

  //// ─────────────────  Tools MCP (consultas)  ───────────────── ////

  this.on('productosPorCategoria', (req) =>
    SELECT.from(Productos).where({ Categoria: req.data.categoria }));

  this.on('ordenesDeTecnico', (req) =>
    SELECT.from(OrdenesServicio)
      .where`tecnico_ID = ${req.data.tecnicoID} and estado_code not in ('CERRADA','CANCELADA')`);

  this.on('productosBajoMinimo', () =>
    SELECT.from(Productos).where`Stock < StockMinimo`);

  this.on('ordenesSlaVencido', () =>
    SELECT.from(OrdenesServicio)
      .where`FechaCompromiso < ${ahora()} and estado_code not in ('CERRADA','CANCELADA')`);

  //// ─────────────────  Alta de orden: nº + SLA  ───────────────── ////

  this.before('CREATE', OrdenesServicio, async (req) => {
    const o = req.data;
    o.estado_code ??= 'NUEVA';
    o.prioridad_code ??= 'MEDIA';
    o.FechaApertura ??= ahora();

    if (!o.Numero) {
      const { n } = await SELECT.one.from(OrdenesServicio).columns('count(*) as n');
      o.Numero = `OS-${año()}-${String((n || 0) + 1).padStart(3, '0')}`;
    }

    // Fecha de compromiso = apertura + SLA del tipo de servicio
    if (o.tipoServicio_ID && !o.FechaCompromiso) {
      const svc = await SELECT.one.from(CatalogoServicios).where({ ID: o.tipoServicio_ID });
      if (svc?.SlaHoras) {
        o.FechaCompromiso = new Date(Date.now() + svc.SlaHoras * 3600 * 1000).toISOString();
      }
    }
  });

  //// ─────────────────  Acciones sobre la orden  ───────────────── ////

  this.on('asignar', OrdenesServicio, async (req) => {
    const { tecnicoID } = req.data;
    const orden = await SELECT.one.from(req.subject);
    if (!orden) return req.error(404, 'Orden no encontrada');
    if (ESTADOS_CERRADOS.includes(orden.estado_code))
      return req.error(409, `No se puede asignar una orden en estado ${orden.estado_code}`);

    const tec = await SELECT.one.from(Tecnicos).where({ ID: tecnicoID });
    if (!tec) return req.error(404, 'Técnico no encontrado');
    if (tec.disponibilidad_code === 'AUSENTE')
      return req.error(409, `El técnico ${tec.Nombre} está ausente`);

    await UPDATE(Tecnicos).set({ disponibilidad_code: 'OCUPADO' }).where({ ID: tecnicoID });
    await UPDATE(req.subject).with({ tecnico_ID: tecnicoID, estado_code: 'ASIGNADA' });
    return SELECT.one.from(req.subject);
  });

  this.on('iniciar', OrdenesServicio, async (req) => {
    const orden = await SELECT.one.from(req.subject);
    if (!orden) return req.error(404, 'Orden no encontrada');
    if (!orden.tecnico_ID) return req.error(409, 'La orden no tiene técnico asignado');
    if (ESTADOS_CERRADOS.includes(orden.estado_code))
      return req.error(409, `La orden está ${orden.estado_code}`);

    await UPDATE(req.subject).with({ estado_code: 'EN_SITIO' });
    return SELECT.one.from(req.subject);
  });

  this.on('cerrar', OrdenesServicio, async (req) => {
    const orden = await SELECT.one.from(req.subject);
    if (!orden) return req.error(404, 'Orden no encontrada');
    if (orden.estado_code === 'CERRADA') return req.error(409, 'La orden ya está cerrada');

    // Costo de repuestos consumidos
    const repuestos = await SELECT.from(LineasRepuesto).where({ orden_ID: orden.ID });
    const costoRepuestos = repuestos.reduce(
      (s, r) => s + Number(r.Cantidad || 0) * Number(r.PrecioUnit || 0), 0);

    // Mano de obra = horas registradas × tarifa del tipo de servicio
    const tiempos = await SELECT.from(RegistrosTiempo).where({ orden_ID: orden.ID });
    const horas = tiempos.reduce((s, t) => s + Number(t.Horas || 0), 0);
    let tarifa = 0;
    if (orden.tipoServicio_ID) {
      const svc = await SELECT.one.from(CatalogoServicios).where({ ID: orden.tipoServicio_ID });
      tarifa = Number(svc?.TarifaHora || 0);
    }
    const costoTotal = +(costoRepuestos + horas * tarifa).toFixed(2);

    // Descontar stock de los repuestos usados
    for (const r of repuestos) {
      if (!r.producto_ID) continue;
      const p = await SELECT.one.from(Productos).where({ ID: r.producto_ID });
      if (p) await UPDATE(Productos)
        .set({ Stock: Math.max(0, Number(p.Stock || 0) - Number(r.Cantidad || 0)) })
        .where({ ID: r.producto_ID });
    }

    // Liberar al técnico
    if (orden.tecnico_ID)
      await UPDATE(Tecnicos).set({ disponibilidad_code: 'DISPONIBLE' }).where({ ID: orden.tecnico_ID });

    await UPDATE(req.subject).with({
      estado_code: 'CERRADA',
      FechaCierre: ahora(),
      CostoTotal: costoTotal,
    });
    return SELECT.one.from(req.subject);
  });

  //// ─────────────────  Recepción de pedido → stock  ───────────────── ////

  this.on('recibir', PedidosCompra, async (req) => {
    const pedido = await SELECT.one.from(req.subject);
    if (!pedido) return req.error(404, 'Pedido no encontrado');
    if (pedido.estado_code === 'RECIBIDO') return req.error(409, 'El pedido ya fue recibido');
    if (pedido.estado_code === 'CANCELADO') return req.error(409, 'El pedido está cancelado');

    const lineas = await SELECT.from(LineasPedido).where({ pedido_ID: pedido.ID });
    for (const l of lineas) {
      if (!l.producto_ID) continue;
      const p = await SELECT.one.from(Productos).where({ ID: l.producto_ID });
      if (p) await UPDATE(Productos)
        .set({ Stock: Number(p.Stock || 0) + Number(l.Cantidad || 0) })
        .where({ ID: l.producto_ID });
    }

    await UPDATE(req.subject).with({ estado_code: 'RECIBIDO' });
    return SELECT.one.from(req.subject);
  });

  //// ─────────────────  Reposición automática  ───────────────── ////

  this.on('generarReposicion', async () => {
    const bajos = await SELECT.from(Productos).where`Stock < StockMinimo`;
    if (!bajos.length) return [];

    // Agrupar por proveedor preferido (los sin proveedor se omiten)
    const porProveedor = {};
    for (const p of bajos) {
      if (!p.ProveedorPref_ID) continue;
      (porProveedor[p.ProveedorPref_ID] ??= []).push(p);
    }

    let { n } = await SELECT.one.from(PedidosCompra).columns('count(*) as n');
    n = n || 0;
    const creados = [];

    for (const [proveedorID, prods] of Object.entries(porProveedor)) {
      n++;
      const lineas = prods.map((p) => ({
        ID: cds.utils.uuid(),
        producto_ID: p.ID,
        Cantidad: Math.max(1, Number(p.StockMinimo || 0) * 2 - Number(p.Stock || 0)),
        PrecioUnit: Number(p.Costo || 0),
      }));
      const total = +lineas.reduce((s, l) => s + l.Cantidad * Number(l.PrecioUnit || 0), 0).toFixed(2);
      const pedidoID = cds.utils.uuid();

      await INSERT.into(PedidosCompra).entries({
        ID: pedidoID,
        Numero: `PC-${año()}-${String(n).padStart(3, '0')}`,
        proveedor_ID: proveedorID,
        estado_code: 'BORRADOR',
        Fecha: hoy(),
        Total: total,
        lineas,
      });
      creados.push(pedidoID);
    }

    return SELECT.from(PedidosCompra).where({ ID: { in: creados } });
  });
});
