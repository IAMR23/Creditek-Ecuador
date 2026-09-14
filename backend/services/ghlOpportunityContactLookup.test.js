const ghl = require("./ghlService");

describe("busqueda de oportunidades GHL por contacto", () => {
  test("consulta por contactId y descarta oportunidades de otros contactos", async () => {
    const client = { request: jest.fn().mockResolvedValue({
      data: {
        opportunities: [
          { id: "opp-1", contactId: "contact-1", status: "open" },
          { id: "opp-2", contactId: "contact-2", status: "open" },
        ],
      },
    }) };
    const result = await ghl.fetchOpportunitiesByContact(client, { locationId: "location-1" }, "contact-1");
    expect(result.map((item) => item.id)).toEqual(["opp-1"]);
    expect(client.request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      url: "/opportunities/search",
      params: expect.objectContaining({ locationId: "location-1", contactId: "contact-1" }),
    }));
  });
});
