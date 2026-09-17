jest.mock("../models/UsuarioAgencia", () => ({
  findOne: jest.fn(),
}));

jest.mock("../utils/tokenConfig", () => ({
  JWT_SECRET: "test-secret",
}));

const jwt = require("jsonwebtoken");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const { authenticate, requirePermission } = require("./authMiddleware");

const crearRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe("requirePermission", () => {
  test("administrador sin Administracion recibe 403", () => {
    const req = {
      user: {
        rol: "administrador",
        permisos: ["Contabilidad"],
      },
    };
    const res = crearRes();
    const next = jest.fn();

    requirePermission("Administracion")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "No tienes permisos para esta accion",
    });
  });

  test("administrador con Administracion continua", () => {
    const req = {
      user: {
        rol: "administrador",
        permisos: ["Administracion"],
      },
    };
    const res = crearRes();
    const next = jest.fn();

    requirePermission("Administracion")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("acepta cualquiera de los permisos requeridos explicitamente", () => {
    const req = {
      user: {
        rol: "administrador",
        permisos: ["Gerencia"],
      },
    };
    const res = crearRes();
    const next = jest.fn();

    requirePermission("Gerencia", "Administracion")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("authenticate y relacion usuario-agencia", () => {
  afterEach(() => jest.restoreAllMocks());

  test("no confia en una relacion inactiva del token y resuelve una relacion activa real", async () => {
    jest.spyOn(jwt, "verify").mockReturnValue({
      usuario: {
        id: 7,
        rol: { nombre: "Repartidor" },
        permisosAsignados: ["Logistica"],
        agenciaPrincipal: { agenciaId: 1, usuarioAgenciaId: 12 },
      },
    });
    UsuarioAgencia.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 118, agenciaId: 2 });
    const req = { headers: { authorization: "Bearer token" } };
    const res = crearRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(req.user).toMatchObject({ id: 7, usuarioAgenciaId: 118, agenciaId: 2 });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("rechaza la sesion si no existe ninguna relacion activa", async () => {
    jest.spyOn(jwt, "verify").mockReturnValue({
      usuario: {
        id: 7,
        permisosAsignados: ["Logistica"],
        agenciaPrincipal: { agenciaId: 1, usuarioAgenciaId: 12 },
      },
    });
    UsuarioAgencia.findOne.mockResolvedValue(null);
    const req = { headers: { authorization: "Bearer token" } };
    const res = crearRes();

    await authenticate(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "USUARIO_AGENCIA_INACTIVA" }),
    );
  });
});
