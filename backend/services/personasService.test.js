jest.mock("../models/Cliente", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const Cliente = require("../models/Cliente");
const {
  buscarPersonaPorCedula,
  normalizarDatosPersona,
  registrarPersona,
} = require("./personasService");

describe("personasService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normaliza datos disponibles y deja los faltantes en null", () => {
    expect(
      normalizarDatosPersona({
        nombre: "  Maria   Perez ",
        celularGestionado: " 0999999999 ",
        correo: " MARIA@EJEMPLO.COM ",
      }),
    ).toEqual({
      cliente: "Maria Perez",
      cedula: null,
      telefono: "0999999999",
      correo: "maria@ejemplo.com",
      direccion: null,
    });
  });

  test("busca una persona por la cedula normalizada", async () => {
    const persona = { id: 12, cedula: "0102030405" };
    Cliente.findOne.mockResolvedValue(persona);

    const resultado = await buscarPersonaPorCedula(" 0102030405 ", {
      attributes: ["id", "cedula"],
    });

    expect(Cliente.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ["id", "cedula"],
        order: [["id", "ASC"]],
      }),
    );
    expect(resultado).toBe(persona);
  });

  test("crea una persona cuando no existe por sus datos de identidad", async () => {
    const creada = { id: 7 };
    Cliente.findOne.mockResolvedValue(null);
    Cliente.create.mockResolvedValue(creada);

    const resultado = await registrarPersona({
      cedula: "0102030405",
      telefono: "0999999999",
    });

    expect(Cliente.findOne).toHaveBeenCalledTimes(2);
    expect(Cliente.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cedula: "0102030405",
        telefono: "0999999999",
        cliente: null,
      }),
      {},
    );
    expect(resultado).toBe(creada);
  });

  test("completa una persona existente sin borrar campos con valores vacios", async () => {
    const persona = { update: jest.fn().mockResolvedValue(undefined) };
    Cliente.findOne.mockResolvedValue(persona);

    const resultado = await registrarPersona({
      nombre: "Ana Torres",
      cedula: "0102030405",
      telefono: "",
      direccion: " Quito ",
    });

    expect(persona.update).toHaveBeenCalledWith(
      {
        cliente: "Ana Torres",
        cedula: "0102030405",
        direccion: "Quito",
      },
      {},
    );
    expect(resultado).toBe(persona);
  });
});
