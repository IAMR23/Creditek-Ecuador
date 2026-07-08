const { isCargoPagoComisionable } = require("./pagosComisionesService");

describe("pagosComisionesService", () => {
  test("incluye usuarios con cargo salarial vendedor de piso aunque el nivel no venga como ASISTENTE", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 2,
        cargo: "Vendedor de Piso",
        nivel: "",
      }),
    ).toBe(true);
  });

  test("incluye vendedor de call center y asistente vendedor", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 3,
        cargo: "Vendedor de Call Center",
        nivel: "ASISTENTE",
      }),
    ).toBe(true);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 4,
        cargo: "Asistente Vendedor",
        nivel: "OPERATIVO",
      }),
    ).toBe(true);
  });

  test("excluye usuarios sin rol de pago o con cargo no comisionable", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: null,
        cargo: "Vendedor de Piso",
        nivel: "ASISTENTE",
      }),
    ).toBe(false);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 9,
        cargo: "Supervisor de Piso",
        nivel: "ENCARGADO",
      }),
    ).toBe(false);
  });
});
