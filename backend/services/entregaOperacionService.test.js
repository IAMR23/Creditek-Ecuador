const mockTransaction = {
  LOCK: { UPDATE: "UPDATE" },
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock("../config/db", () => ({
  sequelize: { transaction: jest.fn(async () => mockTransaction) },
}));
jest.mock("../models/Entrega", () => ({ findByPk: jest.fn(), findAll: jest.fn() }));
jest.mock("../models/EntregaEvento", () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock("../models/UsuarioAgencia", () => ({ findOne: jest.fn(), findByPk: jest.fn() }));
jest.mock("../models/UsuarioAgenciaEntrega", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({ findOne: jest.fn() }));
jest.mock("../models/Rol", () => ({}));

const Entrega = require("../models/Entrega");
const EntregaEvento = require("../models/EntregaEvento");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const UsuarioAgenciaEntrega = require("../models/UsuarioAgenciaEntrega");
const Usuario = require("../models/Usuario");
const {
  actualizarEstado,
  cambiarResponsable,
  desactivarUsuarioAgencia,
} = require("./entregaOperacionService");

const instancia = (values) => ({
  ...values,
  update: jest.fn(function update(changes) {
    Object.assign(this, changes);
    return Promise.resolve(this);
  }),
});

describe("entregaOperacionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EntregaEvento.findOne.mockResolvedValue(null);
    EntregaEvento.create.mockResolvedValue({ id: 1 });
    UsuarioAgencia.findOne.mockResolvedValue({ id: 22, usuarioId: 7, activo: true });
    Usuario.findOne.mockResolvedValue({ id: 7, activo: true, rol: { nombre: "Repartidor" }, roles: [] });
  });

  test("rechaza una version obsoleta y revierte la transaccion", async () => {
    Entrega.findByPk.mockResolvedValue(instancia({ id: 10, estado: "Pendiente", version: 3 }));

    await expect(
      cambiarResponsable({
        entregaId: 10,
        usuarioAgenciaId: 22,
        expectedVersion: 2,
        actorUsuarioId: 1,
        motivo: "Asignacion",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "ENTREGA_DESACTUALIZADA" });
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(UsuarioAgenciaEntrega.create).not.toHaveBeenCalled();
  });

  test("impide operar una entrega de otra agencia", async () => {
    Entrega.findByPk.mockResolvedValue(
      instancia({ id: 10, usuarioAgenciaId: 90, estado: "Pendiente", version: 0 }),
    );
    UsuarioAgencia.findOne.mockResolvedValueOnce(null);

    await expect(
      cambiarResponsable({
        entregaId: 10,
        usuarioAgenciaId: 22,
        expectedVersion: 0,
        actorUsuarioId: 1,
        motivo: "Intento fuera de agencia",
        scopeAgenciaId: 5,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "ENTREGA_FUERA_DE_AGENCIA" });
    expect(UsuarioAgenciaEntrega.create).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  test("reasigna conservando el episodio anterior y registra auditoria", async () => {
    const entrega = instancia({ id: 10, estado: "Transito", version: 4 });
    const anterior = instancia({ id: 31, usuario_agencia_id: 11, activo: true, estado: "Asignada" });
    const nueva = instancia({ id: 32, usuario_agencia_id: 22, activo: true });
    Entrega.findByPk.mockResolvedValue(entrega);
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(anterior);
    UsuarioAgenciaEntrega.create.mockResolvedValue(nueva);

    const resultado = await cambiarResponsable({
      entregaId: 10,
      usuarioAgenciaId: 22,
      expectedVersion: 4,
      actorUsuarioId: 1,
      motivo: "Cambio de ruta",
      forzarReasignacion: true,
      idempotencyKey: "op-1",
    });

    expect(anterior.update).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false, estado: "Reasignada" }),
      { transaction: mockTransaction },
    );
    expect(UsuarioAgenciaEntrega.create).toHaveBeenCalledWith(
      expect.objectContaining({ entrega_id: 10, usuario_agencia_id: 22, activo: true }),
      { transaction: mockTransaction },
    );
    expect(entrega.version).toBe(5);
    expect(EntregaEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "RESPONSABLE_CAMBIADO",
        usuarioAgenciaAnteriorId: 11,
        usuarioAgenciaNuevoId: 22,
      }),
      { transaction: mockTransaction },
    );
    expect(resultado.asignacion).toBe(nueva);
    expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
  });

  test("si falla la auditoria no confirma cambios parciales", async () => {
    Entrega.findByPk.mockResolvedValue(instancia({ id: 10, estado: "Pendiente", version: 0 }));
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(null);
    UsuarioAgenciaEntrega.create.mockResolvedValue(instancia({ id: 50 }));
    EntregaEvento.create.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      cambiarResponsable({
        entregaId: 10,
        usuarioAgenciaId: 22,
        expectedVersion: 0,
        actorUsuarioId: 1,
        motivo: "Asignacion",
      }),
    ).rejects.toThrow("audit unavailable");
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  test("el mismo responsable puede iniciar Transito sin crear otro episodio", async () => {
    const entrega = instancia({ id: 10, estado: "Pendiente", version: 1 });
    const asignacion = instancia({ id: 31, usuario_agencia_id: 22, activo: true });
    Entrega.findByPk.mockResolvedValue(entrega);
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(asignacion);

    await cambiarResponsable({
      entregaId: 10,
      usuarioAgenciaId: 22,
      expectedVersion: 1,
      actorUsuarioId: 1,
      motivo: "Inicio de ruta",
      iniciarTransito: true,
      datosOperacion: { sectorEntrega: "Norte" },
    });

    expect(UsuarioAgenciaEntrega.create).not.toHaveBeenCalled();
    expect(asignacion.update).not.toHaveBeenCalled();
    expect(entrega).toMatchObject({ estado: "Transito", version: 2, sectorEntrega: "Norte" });
    expect(EntregaEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ mismoResponsable: true }) }),
      { transaction: mockTransaction },
    );
  });

  test("traduce la colision del indice activo en conflicto 409", async () => {
    Entrega.findByPk.mockResolvedValue(instancia({ id: 10, estado: "Pendiente", version: 0 }));
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(null);
    const error = Object.assign(new Error("duplicate"), { name: "SequelizeUniqueConstraintError" });
    UsuarioAgenciaEntrega.create.mockRejectedValue(error);

    await expect(
      cambiarResponsable({
        entregaId: 10,
        usuarioAgenciaId: 22,
        expectedVersion: 0,
        actorUsuarioId: 1,
        motivo: "Asignacion concurrente",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "ASIGNACION_CONCURRENTE" });
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  test("finaliza estado, version, asignacion y evento en una sola transaccion", async () => {
    const entrega = instancia({ id: 10, estado: "Transito", version: 8 });
    const asignacion = instancia({ id: 31, usuario_agencia_id: 22, activo: true });
    Entrega.findByPk.mockResolvedValue(entrega);
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(asignacion);

    await actualizarEstado({
      entregaId: 10,
      nuevoEstado: "Entregado",
      expectedVersion: 8,
      actorUsuarioId: 7,
      motivo: "Cliente recibio",
      responsableRequeridoId: 22,
    });

    expect(entrega).toMatchObject({ estado: "Entregado", version: 9 });
    expect(asignacion.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "Finalizada", fecha_finalizacion: expect.any(Date) }),
      { transaction: mockTransaction },
    );
    expect(EntregaEvento.create).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "ESTADO_CAMBIADO", estadoAnterior: "Transito", estadoNuevo: "Entregado" }),
      { transaction: mockTransaction },
    );
  });

  test("una entrega finalizada no puede reabrirse por la operacion de estado", async () => {
    Entrega.findByPk.mockResolvedValue(
      instancia({ id: 10, estado: "Entregado", version: 9 }),
    );

    await expect(
      actualizarEstado({
        entregaId: 10,
        nuevoEstado: "Transito",
        expectedVersion: 9,
        actorUsuarioId: 1,
        motivo: "Intento de reapertura",
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "TRANSICION_INVALIDA" });
    expect(EntregaEvento.create).not.toHaveBeenCalled();
    expect(mockTransaction.rollback).toHaveBeenCalled();
  });

  test("bloquea desactivar una relacion con entregas abiertas sin destino", async () => {
    UsuarioAgencia.findByPk.mockResolvedValue(instancia({ id: 11, activo: true }));
    UsuarioAgenciaEntrega.findAll.mockResolvedValue([{ entrega_id: 10 }]);
    Entrega.findAll.mockResolvedValue([{ id: 10, estado: "Transito", version: 1 }]);

    await expect(
      desactivarUsuarioAgencia({
        usuarioAgenciaId: 11,
        actorUsuarioId: 1,
        motivo: "Baja",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ENTREGAS_ABIERTAS_REQUIEREN_REASIGNACION",
      details: { entregaIds: [10], total: 1 },
    });
    expect(mockTransaction.rollback).toHaveBeenCalledTimes(1);
  });

  test("desactiva y traslada solo entregas abiertas, conservando las finalizadas", async () => {
    const relacion = instancia({ id: 11, activo: true });
    const asignacionAbierta = instancia({ id: 31, entrega_id: 10, usuario_agencia_id: 11, activo: true });
    const asignacionFinal = instancia({ id: 32, entrega_id: 20, usuario_agencia_id: 11, activo: true });
    const entregaAbierta = instancia({ id: 10, usuarioAgenciaId: 70, estado: "Transito", version: 4, activo: true });
    UsuarioAgencia.findByPk.mockResolvedValue(relacion);
    UsuarioAgenciaEntrega.findAll.mockResolvedValue([asignacionAbierta, asignacionFinal]);
    Entrega.findAll.mockResolvedValue([entregaAbierta]);
    Entrega.findByPk.mockResolvedValue(entregaAbierta);
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(asignacionAbierta);
    UsuarioAgenciaEntrega.create.mockResolvedValue(instancia({ id: 40, usuario_agencia_id: 22 }));

    const resultado = await desactivarUsuarioAgencia({
      usuarioAgenciaId: 11,
      responsableDestinoId: 22,
      actorUsuarioId: 1,
      motivo: "Cambio de agencia verificado",
    });

    expect(resultado.entregasTrasladadas).toEqual([{ entregaId: 10, version: 5 }]);
    expect(asignacionAbierta.update).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false, estado: "Reasignada" }),
      { transaction: mockTransaction },
    );
    expect(asignacionFinal.update).not.toHaveBeenCalled();
    expect(relacion.update).toHaveBeenCalledWith(
      { activo: false },
      { transaction: mockTransaction },
    );
    expect(entregaAbierta.estado).toBe("Transito");
    expect(mockTransaction.commit).toHaveBeenCalled();
  });

  test("volver a un responsable anterior crea un episodio nuevo sin reutilizar historia", async () => {
    const entrega = instancia({ id: 10, usuarioAgenciaId: 70, estado: "Transito", version: 6 });
    const actual = instancia({ id: 55, usuario_agencia_id: 22, activo: true });
    const nuevoEpisodio = instancia({ id: 56, usuario_agencia_id: 11, activo: true });
    Entrega.findByPk.mockResolvedValue(entrega);
    UsuarioAgenciaEntrega.findOne.mockResolvedValue(actual);
    UsuarioAgenciaEntrega.create.mockResolvedValue(nuevoEpisodio);

    const resultado = await cambiarResponsable({
      entregaId: 10,
      usuarioAgenciaId: 11,
      expectedVersion: 6,
      actorUsuarioId: 1,
      motivo: "Retorno verificado",
      forzarReasignacion: true,
    });

    expect(UsuarioAgenciaEntrega.create).toHaveBeenCalledTimes(1);
    expect(UsuarioAgenciaEntrega.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_agencia_id: 11, entrega_id: 10 }),
      { transaction: mockTransaction },
    );
    expect(resultado.asignacion.id).toBe(56);
    expect(entrega).toMatchObject({ id: 10, estado: "Transito", version: 7 });
  });
});
