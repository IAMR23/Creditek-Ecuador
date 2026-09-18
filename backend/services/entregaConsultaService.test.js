const { Op } = require("sequelize");
const {
  CLASIFICACIONES_INFORME_ENTREGA,
  criteriosAsignacionVigente,
  criteriosClasificacionInformeEntrega,
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

  test.each(["Entrega", "Envio"])(
    "filtra el informe por tipo %s",
    (clasificacion) => {
      expect(criteriosClasificacionInformeEntrega(clasificacion)).toEqual({
        tipoEntrega: clasificacion,
      });
    },
  );

  test("filtra procesos completos con la misma regla de llamada del dashboard", () => {
    expect(criteriosClasificacionInformeEntrega("ProcesoCompleto")).toEqual({
      [Op.and]: [
        { FechaHoraLlamada: null },
        {
          [Op.or]: [{ fotoFechaLlamada: null }, { fotoFechaLlamada: "" }],
        },
      ],
    });
  });

  test("acepta todos y rechaza clasificaciones desconocidas", () => {
    expect(criteriosClasificacionInformeEntrega("")).toEqual({});
    expect(criteriosClasificacionInformeEntrega("todos")).toEqual({});
    expect(CLASIFICACIONES_INFORME_ENTREGA).toEqual([
      "Entrega",
      "Envio",
      "ProcesoCompleto",
    ]);
    expect(() => criteriosClasificacionInformeEntrega("Retiro")).toThrow(
      RangeError,
    );
  });
});
