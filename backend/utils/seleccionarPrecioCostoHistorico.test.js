const {
  PRECIO_CARGA,
  PRECIO_CONTADO,
  PRECIO_TARJETA_CREDITO,
  obtenerTipoPrecioFormaPago,
  seleccionarPrecioCostoHistorico,
} = require("./seleccionarPrecioCostoHistorico");

const costo = {
  precioCarga: "500.00",
  precioContado: "485.00",
  precioTarjetaCredito: "490.00",
};

describe("seleccionarPrecioCostoHistorico", () => {
  test("usa precio carga para credito directo por id", () => {
    expect(obtenerTipoPrecioFormaPago({ id: 1, nombre: "Credito" })).toBe(
      PRECIO_CARGA,
    );
    expect(seleccionarPrecioCostoHistorico(costo, { id: 1 }).precio).toBe(500);
  });

  test("usa el PVP de tarjeta para tarjeta de credito", () => {
    const resultado = seleccionarPrecioCostoHistorico(costo, {
      id: 3,
      nombre: "TARJETA DE CREDITO",
    });

    expect(resultado.tipoPrecio).toBe(PRECIO_TARJETA_CREDITO);
    expect(resultado.precio).toBe(490);
    expect(obtenerTipoPrecioFormaPago({ nombre: "Tarjeta" })).toBe(
      PRECIO_TARJETA_CREDITO,
    );
  });

  test("usa contado para efectivo o transferencia", () => {
    expect(
      seleccionarPrecioCostoHistorico(costo, { nombre: "Transferencia" }),
    ).toEqual(
      expect.objectContaining({ tipoPrecio: PRECIO_CONTADO, precio: 485 }),
    );
  });

  test("mantiene compatibilidad usando contado si el historico no tiene tarjeta", () => {
    const resultado = seleccionarPrecioCostoHistorico(
      { ...costo, precioTarjetaCredito: null },
      { nombre: "Tarjeta de credito" },
    );

    expect(resultado.tipoPrecioSolicitado).toBe(PRECIO_TARJETA_CREDITO);
    expect(resultado.tipoPrecio).toBe(PRECIO_CONTADO);
    expect(resultado.precio).toBe(485);
  });
});
