const express = require("express");
const request = require("supertest");

jest.mock("../services/personasService", () => ({
  buscarPersonaPorCedula: jest.fn(),
}));

jest.mock("../models/Cliente", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const { buscarPersonaPorCedula } = require("../services/personasService");
const clienteRoutes = require("./clienteRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use(express.json());
  app.use("/clientes", clienteRoutes);
  return app;
};

describe("GET /clientes/cedula/:cedula", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("devuelve los datos cuando el cliente existe", async () => {
    buscarPersonaPorCedula.mockResolvedValue({
      id: 8,
      cliente: "Maria Perez",
      cedula: "0102030405",
      telefono: "0999999999",
      correo: "maria@example.com",
      direccion: "Quito",
    });

    const response = await request(crearAplicacion()).get(
      "/clientes/cedula/0102030405",
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      encontrado: true,
      cliente: expect.objectContaining({
        cliente: "Maria Perez",
        cedula: "0102030405",
      }),
    });
    expect(buscarPersonaPorCedula).toHaveBeenCalledWith("0102030405", {
      attributes: [
        "id",
        "cliente",
        "cedula",
        "telefono",
        "correo",
        "direccion",
      ],
    });
  });

  test("indica que debe ingresarse un cliente nuevo cuando no existe", async () => {
    buscarPersonaPorCedula.mockResolvedValue(null);

    const response = await request(crearAplicacion()).get(
      "/clientes/cedula/0102030405",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      encontrado: false,
      mensaje: "Cliente nuevo, por favor ingrese los datos.",
    });
  });

  test("rechaza una cedula que no tenga diez digitos", async () => {
    const response = await request(crearAplicacion()).get(
      "/clientes/cedula/123",
    );

    expect(response.status).toBe(400);
    expect(buscarPersonaPorCedula).not.toHaveBeenCalled();
  });
});
