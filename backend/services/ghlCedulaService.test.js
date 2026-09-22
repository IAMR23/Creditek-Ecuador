const {
  actualizarCedulaContactoDesdeMensaje,
  detectarCedulaEcuatoriana,
  esCedulaEcuatorianaValida,
  extraerContactoDesdeUpsert,
  normalizarPosibleCedula,
} = require("./ghlCedulaService");

const CEDULA_VALIDA = "1710034065";
const PHONE = "+593991234567";
const FIELD_ID = "field-cedula";
const CONTACT_ID = "contact-1";

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDependencies = ({
  contact = {},
  contacts = null,
  definitions = [{ id: FIELD_ID, fieldKey: "contact.cdula" }],
  updateError = null,
} = {}) => {
  const logger = createLogger();
  const resolvedContacts = contacts || [
    {
      id: CONTACT_ID,
      phone: PHONE,
      name: "Cliente",
      customFields: [],
      ...contact,
    },
  ];
  const requestGhl = jest.fn()
    .mockResolvedValueOnce({
      contacts: resolvedContacts,
    })
    .mockResolvedValueOnce({ customFields: definitions });

  if (updateError) requestGhl.mockRejectedValueOnce(updateError);
  else requestGhl.mockResolvedValueOnce({ succeeded: true });

  return {
    dependencies: {
      logger,
      getGhlConfig: jest.fn(() => ({
        locationId: "location-1",
        token: "test-token",
        baseUrl: "https://example.test",
        apiVersion: "2021-07-28",
      })),
      createGhlClient: jest.fn(() => ({ client: true })),
      requestGhl,
    },
    logger,
    requestGhl,
  };
};

describe("deteccion y validacion de cedula ecuatoriana", () => {
  test("detecta una cedula valida enviada sola", () => {
    expect(detectarCedulaEcuatoriana(CEDULA_VALIDA)).toBe(CEDULA_VALIDA);
  });

  test("detecta una cedula valida dentro de una frase", () => {
    expect(detectarCedulaEcuatoriana(`Mi cedula es ${CEDULA_VALIDA}`)).toBe(
      CEDULA_VALIDA,
    );
  });

  test.each([
    "1710 034 065",
    "1710-034-065",
    "1710.034.065",
    "171003406-5",
  ])("acepta espacios, puntos o guiones: %s", (message) => {
    expect(detectarCedulaEcuatoriana(message)).toBe(CEDULA_VALIDA);
  });

  test("normaliza un guion antes del digito verificador sin inventar digitos", () => {
    expect(normalizarPosibleCedula("123456789-0")).toBe("1234567890");
    expect(normalizarPosibleCedula("12345678-9")).toBeNull();
  });

  test("rechaza una cedula con digito verificador incorrecto", () => {
    expect(esCedulaEcuatorianaValida("1710034064")).toBe(false);
    expect(detectarCedulaEcuatoriana("Mi cedula es 1710034064")).toBeNull();
  });

  test("rechaza un numero telefonico", () => {
    expect(detectarCedulaEcuatoriana("0991234567")).toBeNull();
  });

  test("rechaza un RUC de 13 digitos", () => {
    expect(detectarCedulaEcuatoriana("1710034065001")).toBeNull();
  });
});

describe("actualizacion del contacto GHL", () => {
  test("actualiza nombre y cedula juntos usando el id de contact.cdula", async () => {
    const { dependencies, logger, requestGhl } = createDependencies();

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: CEDULA_VALIDA, isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("updated");
    expect(requestGhl).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      {
        method: "PUT",
        url: `/contacts/${CONTACT_ID}`,
        retryOn5xx: true,
        data: {
          name: CEDULA_VALIDA,
          customFields: [{ id: FIELD_ID, fieldValue: CEDULA_VALIDA }],
        },
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Cedula detectada y guardada correctamente en GHL.",
      { cedula: CEDULA_VALIDA },
    );
  });

  test("usa el contacto devuelto por upsert sin buscarlo de inmediato", async () => {
    const { dependencies, requestGhl } = createDependencies();
    requestGhl.mockReset()
      .mockResolvedValueOnce({
        customFields: [{ id: FIELD_ID, fieldKey: "contact.cdula" }],
      })
      .mockResolvedValueOnce({ succeeded: true });

    const result = await actualizarCedulaContactoDesdeMensaje(
      {
        phone: PHONE,
        message: CEDULA_VALIDA,
        isFromMe: false,
        upsertResponse: {
          contact: {
            id: CONTACT_ID,
            phone: PHONE,
            name: "Cliente",
            customFields: [],
          },
        },
      },
      dependencies,
    );

    expect(result).toEqual({
      status: "updated",
      cedula: CEDULA_VALIDA,
      contactId: CONTACT_ID,
    });
    expect(requestGhl).toHaveBeenCalledTimes(2);
    expect(requestGhl).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ url: "/contacts/search" }),
    );
    expect(requestGhl).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        method: "GET",
        url: "/locations/location-1/customFields",
      }),
    );
  });

  test.each([
    [{ contact: { id: CONTACT_ID } }],
    [{ data: { contact: { id: CONTACT_ID } } }],
    [{ data: { id: CONTACT_ID } }],
    [{ contactId: CONTACT_ID }],
  ])("extrae el ID del contacto desde respuestas comunes de upsert", (payload) => {
    expect(extraerContactoDesdeUpsert(payload)).toEqual(
      expect.objectContaining(
        payload.contactId ? { contactId: CONTACT_ID } : { id: CONTACT_ID },
      ),
    );
  });

  test("una cedula invalida no consulta GHL ni cambia el nombre", async () => {
    const { dependencies, requestGhl } = createDependencies();

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: "1710034064", isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("no_valid_cedula");
    expect(dependencies.getGhlConfig).not.toHaveBeenCalled();
    expect(requestGhl).not.toHaveBeenCalled();
  });

  test("un mensaje del asesor no consulta GHL ni cambia el nombre", async () => {
    const { dependencies, requestGhl } = createDependencies();

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: CEDULA_VALIDA, isFromMe: true },
      dependencies,
    );

    expect(result.status).toBe("ignored_sender");
    expect(dependencies.getGhlConfig).not.toHaveBeenCalled();
    expect(requestGhl).not.toHaveBeenCalled();
  });

  test("no repite la actualizacion si nombre y campo ya coinciden", async () => {
    const { dependencies, requestGhl } = createDependencies({
      contact: {
        name: CEDULA_VALIDA,
        customFields: [{ id: FIELD_ID, value: CEDULA_VALIDA }],
      },
    });

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: CEDULA_VALIDA, isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("unchanged");
    expect(requestGhl).toHaveBeenCalledTimes(2);
    expect(requestGhl).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  test("no crea contactos cuando la busqueda por telefono no encuentra uno", async () => {
    const { dependencies, logger, requestGhl } = createDependencies({ contacts: [] });

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: CEDULA_VALIDA, isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("contact_not_found");
    expect(requestGhl).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "Contacto GHL no encontrado para la cedula detectada.",
    );
  });

  test("no actualiza el nombre si contact.cdula no esta configurado", async () => {
    const { dependencies, logger, requestGhl } = createDependencies({
      definitions: [{ id: "other-field", fieldKey: "contact.otro_campo" }],
    });

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: CEDULA_VALIDA, isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("custom_field_not_configured");
    expect(requestGhl).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "Campo personalizado GHL no configurado.",
      { fieldKey: "contact.cdula" },
    );
  });

  test("un error de GHL se absorbe y se registra sin lanzar", async () => {
    const error = Object.assign(new Error("fallo remoto"), {
      code: "GHL_UPSTREAM_ERROR",
      upstreamStatus: 502,
    });
    const { dependencies, logger } = createDependencies({ updateError: error });

    await expect(
      actualizarCedulaContactoDesdeMensaje(
        { phone: PHONE, message: CEDULA_VALIDA, isFromMe: false },
        dependencies,
      ),
    ).resolves.toEqual({ status: "error", cedula: CEDULA_VALIDA });
    expect(logger.error).toHaveBeenCalledWith(
      "Error al actualizar el contacto en GHL.",
      { code: "GHL_UPSTREAM_ERROR", status: 502 },
    );
  });

  test("un mensaje sin cedula no genera consultas adicionales a GHL", async () => {
    const { dependencies, requestGhl } = createDependencies();

    const result = await actualizarCedulaContactoDesdeMensaje(
      { phone: PHONE, message: "Hola, necesito informacion", isFromMe: false },
      dependencies,
    );

    expect(result.status).toBe("no_valid_cedula");
    expect(dependencies.getGhlConfig).not.toHaveBeenCalled();
    expect(requestGhl).not.toHaveBeenCalled();
  });
});
