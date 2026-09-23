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

test("reconoce las variantes de efectivo, tarjeta de credito y transferencia", () => {
  expect(clasificarFormaPagoVenta("Contado")).toBe("EFECTIVO");
  expect(clasificarFormaPagoVenta("Tarj. Credito")).toBe("TARJETA_CREDITO");
  expect(clasificarFormaPagoVenta("Tar. Credito")).toBe("TARJETA_CREDITO");
  expect(clasificarFormaPagoVenta("Transferencia")).toBe("TRANSFERENCIA");
  expect(clasificarFormaPagoVenta("Transfer")).toBe("TRANSFERENCIA");
  expect(clasificarFormaPagoVenta("Crédito Directo")).toBeNull();
});

test("incluye efectivo, tarjeta y transferencia en las ventas contado", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [
      ventaBase,
      {
        ...ventaBase,
        id: 11,
        detalleVentaId: 21,
        formaPago: "Tar. Credito",
      },
      {
        ...ventaBase,
        id: 12,
        detalleVentaId: 22,
        formaPago: "Transfer",
      },
    ],
  });

  expect(auditoria.resumen.totalVentasContado).toBe(3);
  expect(auditoria.resultados.map((resultado) => resultado.tipoPago)).toEqual([
    "EFECTIVO",
    "TARJETA_CREDITO",
    "TRANSFERENCIA",
  ]);
});

test("clasifica contado por forma de pago aunque el cierre historico sea distinto", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [
      { ...ventaBase, cierreCaja: "CREDITV", formaPago: "Efectivo" },
      {
        ...ventaBase,
        id: 11,
        detalleVentaId: 21,
        cierreCaja: "UPHONE",
        formaPago: "Tarjeta de credito",
      },
      {
        ...ventaBase,
        id: 12,
        detalleVentaId: 22,
        cierreCaja: "PENDIENTE",
        formaPago: "Transferencia",
      },
    ],
  });

  expect(auditoria.resumen.totalVentasContado).toBe(3);
  expect(auditoria.resultados.map((resultado) => resultado.tipoPago)).toEqual([
    "EFECTIVO",
    "TARJETA_CREDITO",
    "TRANSFERENCIA",
  ]);
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

test("si tarjeta de credito no aparece indica revisar el grupo de transferencias", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [{ ...ventaBase, formaPago: "Tarjeta de credito" }],
  });

  expect(auditoria.resumen.revisarBancos).toBe(1);
  expect(auditoria.resultados[0]).toMatchObject({
    estado: "REVISAR_EN_BANCOS",
    observacion: "REVISAR EL GRUPO DE TRANSFERENCIAS",
  });
});

test("si tarjeta de credito aparece en caja mantiene la observacion de revision", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [{ ...ventaBase, formaPago: "Tarjeta de credito" }],
    cierres: [cierreBase],
    movimientos: [{ ...movimientoBase, detalle: "TARJETA DE CREDITO" }],
  });

  expect(auditoria.resultados[0]).toMatchObject({
    estado: "COINCIDE_CAJA",
    observacion: "REVISAR EL GRUPO DE TRANSFERENCIAS",
    movimientoCajaId: 200,
  });
});

test("encuentra una venta por transferencia en caja", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [{ ...ventaBase, formaPago: "Transferencia" }],
    cierres: [cierreBase],
    movimientos: [{ ...movimientoBase, formaPago: "TRANSFERENCIA" }],
    agencias: [{ id: 99, nombre: "Agencia distinta" }],
  });

  expect(auditoria.resumen).toMatchObject({
    totalVentasContado: 1,
    coincidenCaja: 1,
    sinRegistroCaja: 0,
  });
  expect(auditoria.resultados[0]).toMatchObject({
    tipoPago: "TRANSFERENCIA",
    estado: "COINCIDE_CAJA",
    observacion: "REVISAR EL GRUPO DE TRANSFERENCIAS",
    movimientoCajaId: 200,
  });
});

test("indica revisar transferencias cuando la venta no aparece en caja", () => {
  const auditoria = construirAuditoriaVentasCaja({
    ventas: [{ ...ventaBase, formaPago: "Transferencia" }],
  });

  expect(auditoria.resumen).toMatchObject({
    totalVentasContado: 1,
    sinRegistroCaja: 0,
    revisarTransferencias: 1,
  });
  expect(auditoria.resultados[0]).toMatchObject({
    tipoPago: "TRANSFERENCIA",
    estado: "REVISAR_EN_TRANSFERENCIAS",
    observacion: "REVISAR EL GRUPO DE TRANSFERENCIAS",
    movimientoCajaId: null,
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

test("acepta un movimiento de caja que coincide con el total de varias ventas", () => {
  const ventas = [
    {
      ...ventaBase,
      id: 31,
      detalleVentaId: 41,
      nombre: "EDISON RAMIRO CHUGCHILAN YUPANGUI",
      precioVendedor: 200,
    },
    {
      ...ventaBase,
      id: 32,
      detalleVentaId: 42,
      nombre: "EDISON RAMIRO CHUGCHILAN YUPANGUI",
      precioVendedor: 200,
    },
  ];
  const auditoria = construirAuditoriaVentasCaja({
    ventas,
    cierres: [cierreBase],
    movimientos: [
      {
        ...movimientoBase,
        entidad: "EDISON RAMIRO CHUGCHILAN YUPANGUI",
        valor: 400,
      },
    ],
    agencias: [{ id: 99, nombre: "Agencia distinta" }],
  });

  expect(auditoria.resumen).toMatchObject({
    totalVentasContado: 2,
    coincidenCaja: 2,
    totalVenta: 400,
    totalCajaCoincidente: 400,
    diferencia: 0,
  });
  expect(auditoria.resultados).toHaveLength(2);
  expect(
    auditoria.resultados.every(
      (resultado) =>
        resultado.estado === "COINCIDE_CAJA" &&
        resultado.movimientoCajaId === 200 &&
        resultado.diferencia === 0 &&
        resultado.tipoCoincidencia.includes("TOTAL_AGRUPADO"),
    ),
  ).toBe(true);
  expect(auditoria.resultados[0].observacion).toContain(
    "2 ventas suman $400.00",
  );
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
