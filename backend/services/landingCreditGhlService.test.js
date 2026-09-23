const {
  LANDING_ORIGIN,
  LANDING_SOURCE,
  normalizeEcuadorPhone,
  resetCustomFieldsCacheForTests,
  splitFullName,
  submitLandingCreditApplication,
  validateLandingCreditApplication,
} = require("./landingCreditGhlService");

const validApplication = {
  fullName: "Ana María López Pérez",
  cedula: "1710034065",
  phone: "0991234567",
  province: "Pichincha",
  productType: "Celular",
  website: "",
};

describe("landingCreditGhlService", () => {
  beforeEach(() => resetCustomFieldsCacheForTests());

  test("normaliza teléfonos móviles ecuatorianos a E.164", () => {
    expect(normalizeEcuadorPhone("099 123 4567")).toBe("+593991234567");
    expect(normalizeEcuadorPhone("+593 99 123 4567")).toBe("+593991234567");
    expect(normalizeEcuadorPhone("022345678")).toBeNull();
  });

  test("conserva el nombre completo y separa los dos apellidos", () => {
    expect(splitFullName("  Ana  María López Pérez ")).toEqual({
      name: "Ana María López Pérez",
      firstName: "Ana María",
      lastName: "López Pérez",
    });
  });

  test("valida cédula, provincia, producto y honeypot en el servidor", () => {
    expect(() => validateLandingCreditApplication({
      ...validApplication,
      cedula: "1700000000",
      website: "spam.example",
    })).toThrow(expect.objectContaining({
      code: "LANDING_CREDIT_VALIDATION_ERROR",
      statusCode: 422,
    }));
  });

  test("resuelve IDs de campos y hace upsert sin crear oportunidad ni workflow", async () => {
    const requestGhl = jest.fn()
      .mockResolvedValueOnce({
        customFields: [
          { id: "field-province", fieldKey: "contact.provincia" },
          { id: "field-id", fieldKey: "contact.cdula" },
          { id: "field-product", fieldKey: "contact.dispositivo" },
          { id: "field-origin", fieldKey: "contact.origen" },
        ],
      })
      .mockResolvedValueOnce({
        new: true,
        contact: { id: "contact-123" },
      });

    const result = await submitLandingCreditApplication(validApplication, {
      getGhlConfig: () => ({ locationId: "location-1" }),
      createGhlClient: () => ({ mocked: true }),
      requestGhl,
    });

    expect(result).toEqual({ contactId: "contact-123", created: true });
    expect(requestGhl).toHaveBeenCalledTimes(2);
    expect(requestGhl.mock.calls[1][1]).toMatchObject({
      method: "POST",
      url: "/contacts/upsert",
      data: {
        locationId: "location-1",
        name: "Ana María López Pérez",
        firstName: "Ana María",
        lastName: "López Pérez",
        phone: "+593991234567",
        country: "EC",
        source: LANDING_SOURCE,
        createNewIfDuplicateAllowed: false,
        customFields: [
          { id: "field-province", fieldValue: "Pichincha" },
          { id: "field-id", fieldValue: "1710034065" },
          { id: "field-product", fieldValue: "Celular" },
          { id: "field-origin", fieldValue: LANDING_ORIGIN },
        ],
      },
    });
    expect(requestGhl.mock.calls.flatMap((call) => [call[1].url])).not.toEqual(
      expect.arrayContaining([expect.stringContaining("opportunit"), expect.stringContaining("workflow")]),
    );
  });

  test("no envía el contacto si falta el campo configurable de producto", async () => {
    const requestGhl = jest.fn().mockResolvedValueOnce({
      customFields: [
        { id: "field-province", fieldKey: "contact.provincia" },
        { id: "field-id", fieldKey: "contact.cdula" },
        { id: "field-origin", fieldKey: "contact.origen" },
      ],
    });

    await expect(submitLandingCreditApplication(validApplication, {
      getGhlConfig: () => ({ locationId: "location-1" }),
      createGhlClient: () => ({}),
      requestGhl,
    })).rejects.toMatchObject({
      code: "GHL_LANDING_CUSTOM_FIELD_MISSING",
      missingFieldKeys: ["contact.dispositivo"],
    });
    expect(requestGhl).toHaveBeenCalledTimes(1);
  });

  test("solo reporta éxito cuando GHL devuelve un contacto confirmado", async () => {
    const requestGhl = jest.fn().mockResolvedValueOnce({});
    await expect(submitLandingCreditApplication(validApplication, {
      getGhlConfig: () => ({ locationId: "location-1" }),
      createGhlClient: () => ({}),
      requestGhl,
      customFieldDefinitions: [
        { id: "field-province", fieldKey: "contact.provincia" },
        { id: "field-id", fieldKey: "contact.cdula" },
        { id: "field-product", fieldKey: "contact.dispositivo" },
        { id: "field-origin", fieldKey: "contact.origen" },
      ],
    })).rejects.toMatchObject({ code: "GHL_CONTACT_NOT_CONFIRMED", statusCode: 502 });
  });
});
