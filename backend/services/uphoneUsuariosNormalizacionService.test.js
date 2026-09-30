jest.mock("../config/db", () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const {
  asignarUsuarioUphone,
  listarNormalizaciones,
  normalizarClave,
} = require("./uphoneUsuariosNormalizacionService");

describe("uphoneUsuariosNormalizacionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } }),
    );
  });

  it("normaliza la clave estable de Uphone", () => {
    expect(normalizarClave("  pablo2027 ")).toBe("PABLO2027");
  });

  it("lista claves del reporte con el usuario actual de RVE", async () => {
    sequelize.query.mockResolvedValue([
      {
        usuarioUphone: "PABLO2027",
        nombreReportado: "PABLO MAURICIO HERRERA ACOSTA",
        solicitudes: "12",
        ultimaSolicitud: "2026-09-30",
        usuarioId: "44",
        usuarioNombre: "Raúl",
        usuarioEmail: "raul@example.com",
        usuarioActivo: true,
      },
    ]);
    Usuario.findAll.mockResolvedValue([
      {
        id: "44",
        nombre: "Raúl",
        email: "raul@example.com",
        activo: true,
        usuarioUphone: "pablo2027",
      },
    ]);

    const resultado = await listarNormalizaciones();

    expect(resultado.normalizaciones).toEqual([
      expect.objectContaining({
        usuarioUphone: "PABLO2027",
        nombreReportado: "PABLO MAURICIO HERRERA ACOSTA",
        solicitudes: 12,
        usuarioRve: expect.objectContaining({ id: 44, nombre: "Raúl" }),
      }),
    ]);
    expect(resultado.usuarios[0]).toEqual(
      expect.objectContaining({ id: 44, usuarioUphone: "PABLO2027" }),
    );
  });

  it("reasigna una clave y libera al propietario anterior", async () => {
    const propietarioActual = {
      id: 8,
      nombre: "Pablo",
      update: jest.fn().mockResolvedValue(undefined),
    };
    const usuarioDestino = {
      id: 44,
      nombre: "Raúl",
      email: "raul@example.com",
      activo: true,
      usuarioUphone: "RAUL2024",
      save: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findOne.mockResolvedValue(propietarioActual);
    Usuario.findByPk.mockResolvedValue(usuarioDestino);

    const resultado = await asignarUsuarioUphone({
      usuarioUphone: " pablo2027 ",
      usuarioId: 44,
    });

    expect(propietarioActual.update).toHaveBeenCalledWith(
      { usuarioUphone: null },
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(usuarioDestino.usuarioUphone).toBe("PABLO2027");
    expect(usuarioDestino.save).toHaveBeenCalled();
    expect(resultado).toEqual(
      expect.objectContaining({
        usuarioUphone: "PABLO2027",
        claveAnterior: "RAUL2024",
        reemplazo: { id: 8, nombre: "Pablo" },
        usuarioRve: expect.objectContaining({ id: 44, nombre: "Raúl" }),
      }),
    );
  });

  it("permite dejar una clave sin asignar", async () => {
    const propietarioActual = {
      id: 44,
      nombre: "Raúl",
      update: jest.fn().mockResolvedValue(undefined),
    };
    Usuario.findOne.mockResolvedValue(propietarioActual);

    const resultado = await asignarUsuarioUphone({
      usuarioUphone: "PABLO2027",
      usuarioId: null,
    });

    expect(propietarioActual.update).toHaveBeenCalledWith(
      { usuarioUphone: null },
      expect.any(Object),
    );
    expect(Usuario.findByPk).not.toHaveBeenCalled();
    expect(resultado.usuarioRve).toBeNull();
  });
});
