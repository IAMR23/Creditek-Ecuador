jest.mock("../models/Usuario", () => ({ update: jest.fn() }));
jest.mock("../models/Rol", () => ({}));
jest.mock("../models/Agencia", () => ({}));
jest.mock("../models/UsuarioAgencia", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/NominaEmpleado", () => ({
  findOrCreate: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
}));
jest.mock("../models/NominaBeneficio", () => ({
  NominaBeneficio: { findOrCreate: jest.fn(), findOne: jest.fn() },
  TIPOS_BENEFICIO_NOMINA: [],
}));
jest.mock("../models/RolPago", () => ({ findOne: jest.fn() }));

const UsuarioAgencia = require("../models/UsuarioAgencia");
const { listarNomina, obtenerNominaPorUsuario } = require("./nominaService");

const includeUsuario = (options) =>
  options.include.find((item) => item.as === "usuario");

describe("filtro de usuarios activos para nomina", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UsuarioAgencia.findAll.mockResolvedValue([]);
  });

  test("el listado excluye usuarios desactivados para nomina", async () => {
    await listarNomina();

    const options = UsuarioAgencia.findAll.mock.calls[0][0];
    expect(includeUsuario(options).where).toEqual({
      activo: true,
      activoNomina: true,
    });
  });

  test("el detalle por usuario tampoco devuelve relaciones fuera de nomina", async () => {
    await obtenerNominaPorUsuario(10);

    const options = UsuarioAgencia.findAll.mock.calls[0][0];
    expect(includeUsuario(options).where).toEqual({ activoNomina: true });
  });
});
