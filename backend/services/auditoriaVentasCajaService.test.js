const {
  clasificarFormaPagoVenta,
  construirAuditoriaVentasCaja,
  compararNombresClientes,
} = require("./auditoriaVentasCajaService");

const ventaBase = {
  id: 10,
  detalleVentaId: 20,
  activo: true,
  fecha: "2026-09-22",
  cierreCaja: "CONTADO",
  formaPago: "Efectivo",
  precioVendedor: 350,
  nombre: "ISMAEL ALEXANDER SIMBAÑA PILATAXI",
  marca: "HONOR",
  modelo: "X5C PLUS",
};

const cierreBase = {
  id: 100,
  fecha: "2026-09-22",
  agenciaId: 99,
};

const movimientoBase = {
  id: 200,
  cierreId: 100,
  detalle: "CONTADO",
  formaPago: "EFECTIVO",
  entidad: "Ismael Simbana",
  valor: 350,
};

test("acepta nombres abreviados y sin tildes", () => {
  expect(
    compararNombresClientes(
      "ISMAEL ALEXANDER SIMBAÑA PILATAXI",
      "ismael simbana",
    ),
  ).toMatchObject({ coincide: true, tipo: "NOMBRE_PARCIAL" });
});

test("reconoce las variantes de efectivo y tarjeta de credito", () => {
  expect(clasificarFormaPagoVenta("Contado")).toBe("EFECTIVO");
  expect(clasificarFormaPagoVenta("Tarj. Credito")).toBe("TARJETA_CREDITO");
});

test("encuentra efectivo en cualquier agencia el mismo dia", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [ventaBase],
    cierres: [cierreBase],
    movimientos: [movimientoBase],
    clientes: [],
    agencias: [{ id: 99, nombre: "Agencia distinta" }],
  });

  expect(auditoria.resumen).toMatchObject({
    totalVentasContado: 1,
    coincidenCaja: 1,
    sinRegistroCaja: 0,
  });
  expect(auditoria.resultados[0]).toMatchObject({
    estado: "COINCIDE_CAJA",
    agenciaCaja: "Agencia distinta",
    clienteCaja: "Ismael Simbana",
    montoCaja: 350,
  });
});

test("no acepta como respaldo un movimiento de otro dia", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [ventaBase],
    cierres: [{ ...cierreBase, fecha: "2026-09-21" }],
    movimientos: [movimientoBase],
  });

  expect(auditoria.resultados[0]).toMatchObject({
    estado: "NO_EN_CAJA",
    movimientoCajaId: null,
  });
});

test("si tarjeta de credito no aparece indica revisar en bancos", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [{ ...ventaBase, formaPago: "Tarjeta de credito" }],
  });

  expect(auditoria.resumen.revisarBancos).toBe(1);
  expect(auditoria.resultados[0]).toMatchObject({
    estado: "REVISAR_EN_BANCOS",
    observacion: "REVISAR EN BANCOS",
  });
});

test("muestra diferencia cuando coincide el cliente pero cambia el valor", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [ventaBase],
    cierres: [cierreBase],
    movimientos: [{ ...movimientoBase, valor: 300 }],
  });

  expect(auditoria.resultados[0]).toMatchObject({
    estado: "MONTO_DIFERENTE_CAJA",
    montoVenta: 350,
    montoCaja: 300,
    diferencia: 50,
  });
});

test("un movimiento de caja no respalda dos ventas", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [
      ventaBase,
      { ...ventaBase, id: 11, detalleVentaId: 21 },
    ],
    cierres: [cierreBase],
    movimientos: [movimientoBase],
  });

  expect(auditoria.resultados.filter((item) => item.movimientoCajaId)).toHaveLength(1);
  expect(auditoria.resultados.filter((item) => item.estado !== "COINCIDE_CAJA")).toHaveLength(1);
});
