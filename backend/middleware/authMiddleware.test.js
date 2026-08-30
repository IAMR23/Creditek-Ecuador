jest.mock("../models/UsuarioAgencia", () => ({
  findOne: jest.fn(),
}));

jest.mock("../utils/tokenConfig", () => ({
  JWT_SECRET: "test-secret",
}));

const { requirePermission } = require("./authMiddleware");

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
