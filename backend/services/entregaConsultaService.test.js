const { Op } = require("sequelize");
const {
  criteriosAsignacionVigente,
  criteriosEntregaPendiente,
  criteriosEntregaVisible,
  responsableRequiereRevision,
} = require("./entregaConsultaService");

describe("criterios compartidos de entregas", () => {
  test("informe y pendientes comparten entrega activa y excluyen Eliminado", () => {
    expect(criteriosEntregaVisible()).toEqual({
      activo: true,
      estado: { [Op.ne]: "Eliminado" },
    });
    expect(criteriosEntregaPendiente()).toEqual({ activo: true, estado: "Transito" });
    expect(criteriosAsignacionVigente()).toEqual({ activo: true });
  });

  test("una asignacion a relacion inactiva permanece visible como anomalia", () => {
    expect(
      responsableRequiereRevision(
        { estado: "Transito" },
        { activo: false, usuario: { activo: true } },
      ),
    ).toBe(true);
    expect(
      responsableRequiereRevision(
        { estado: "Transito" },
        { activo: true, usuario: { activo: true } },
      ),
    ).toBe(false);
  });
});
