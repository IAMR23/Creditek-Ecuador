const {
  calcularIndicadoresCostoHistorico,
} = require("./calcularIndicadoresCostoHistorico");

describe("calcularIndicadoresCostoHistorico", () => {
  test("conserva el margen sobre venta y calcula la utilidad sobre costo", () => {
    expect(calcularIndicadoresCostoHistorico(150, 100)).toEqual({
      margen: 50,
      margenPorcentual: 33.33,
      utilidad: 50,
      utilidadSobreCosto: 50,
      rentabilidad: 50,
    });
  });

  test("calcula aproximadamente 53 por ciento para el Redmi 15C", () => {
    expect(calcularIndicadoresCostoHistorico(225, 147)).toEqual({
      margen: 78,
      margenPorcentual: 34.67,
      utilidad: 78,
      utilidadSobreCosto: 53.06,
      rentabilidad: 53.06,
    });
  });

  test("acepta precio cero y devuelve una perdida del cien por ciento sobre costo", () => {
    expect(calcularIndicadoresCostoHistorico(0, 100)).toEqual({
      margen: -100,
      margenPorcentual: null,
      utilidad: -100,
      utilidadSobreCosto: -100,
      rentabilidad: -100,
    });
  });

  test("devuelve valores nulos cuando falta el precio de venta", () => {
    expect(calcularIndicadoresCostoHistorico(null, 100)).toEqual({
      margen: null,
      margenPorcentual: null,
      utilidad: null,
      utilidadSobreCosto: null,
      rentabilidad: null,
    });
  });

  test("evita dividir para cero", () => {
    expect(calcularIndicadoresCostoHistorico(100, 0)).toEqual({
      margen: 100,
      margenPorcentual: 100,
      utilidad: 100,
      utilidadSobreCosto: null,
      rentabilidad: null,
    });
  });

  test("devuelve rentabilidad cero cuando la utilidad es cero", () => {
    expect(calcularIndicadoresCostoHistorico(100, 100)).toEqual({
      margen: 0,
      margenPorcentual: 0,
      utilidad: 0,
      utilidadSobreCosto: 0,
      rentabilidad: 0,
    });
  });
});
