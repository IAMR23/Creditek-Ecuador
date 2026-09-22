const GhlWorkflowEjecucionDetalle = require("./GhlWorkflowEjecucionDetalle");

describe("GhlWorkflowEjecucionDetalle", () => {
  test("usa nombres de indices cortos y alineados con la migracion", () => {
    expect(GhlWorkflowEjecucionDetalle.options.indexes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "ghl_workflow_detalle_contacto_unique",
        unique: true,
      }),
      expect.objectContaining({
        name: "ghl_workflow_detalle_reingreso_off_idx",
        fields: ["configuracionId", "contactId", "workflowId", "estado"],
      }),
      expect.objectContaining({
        name: "ghl_workflow_detalle_reingreso_day_idx",
        fields: ["contactId", "workflowId", "fechaLocal", "estado"],
      }),
    ]));

    for (const index of GhlWorkflowEjecucionDetalle.options.indexes) {
      expect(Buffer.byteLength(index.name, "utf8")).toBeLessThanOrEqual(63);
    }
  });
});
