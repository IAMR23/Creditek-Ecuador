const {
  fetchWorkflows,
  isWorkflowActive,
  validateWorkflow,
  enrollContactInWorkflow,
} = require("./ghlService");

describe("integracion GHL para workflows existentes", () => {
  test("lista workflows conservando el contrato camelCase y Version v3", async () => {
    const client = { request: jest.fn().mockResolvedValue({ data: { workflows: [{ id: "wf-1", name: "Seguimiento", status: "published" }] } }) };
    const rows = await fetchWorkflows(client, { locationId: "loc-1" });
    expect(rows).toHaveLength(1);
    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      url: "/workflows/",
      params: { locationId: "loc-1" },
      headers: { Version: "v3" },
    }));
  });

  test("solo considera activos los estados active o published", () => {
    expect(isWorkflowActive({ status: "published" })).toBe(true);
    expect(isWorkflowActive({ status: "active" })).toBe(true);
    expect(isWorkflowActive({ status: "draft" })).toBe(false);
  });

  test("valida que el workflow siga disponible y activo", async () => {
    const client = { request: jest.fn().mockResolvedValue({ data: { workflows: [{ id: "wf-1", status: "draft" }] } }) };
    await expect(validateWorkflow(client, { locationId: "loc-1" }, "wf-1"))
      .rejects.toMatchObject({ code: "GHL_WORKFLOW_INACTIVE" });
  });

  test("inscribe un contacto existente sin crear ni actualizar contactos", async () => {
    const client = { request: jest.fn().mockResolvedValue({ data: { succeeded: true } }) };
    await enrollContactInWorkflow(client, {}, "contact-1", "workflow-1", { eventStartTime: "2026-09-21T15:00:00.000Z" });
    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      url: "/contacts/contact-1/workflow/workflow-1",
      data: { eventStartTime: "2026-09-21T15:00:00.000Z" },
    }));
  });

  test("no repite un POST cuando un 5xx deja el resultado ambiguo", async () => {
    const client = { request: jest.fn().mockRejectedValue({ response: { status: 500, data: {}, headers: {} } }) };
    await expect(enrollContactInWorkflow(client, {}, "contact-1", "workflow-1"))
      .rejects.toMatchObject({ code: "GHL_UPSTREAM_ERROR" });
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  test("explica el scope requerido sin exponer el token", async () => {
    const client = { request: jest.fn().mockRejectedValue({ response: { status: 403, data: {}, headers: {} } }) };
    await expect(fetchWorkflows(client, { locationId: "loc-1" })).rejects.toMatchObject({
      code: "GHL_WORKFLOWS_SCOPE_REQUIRED",
      message: "El token de HighLevel requiere el permiso workflows.readonly",
    });
  });
});
