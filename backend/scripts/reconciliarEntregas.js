/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");
require("../models/associations");
const Entrega = require("../models/Entrega");
const EntregaEvento = require("../models/EntregaEvento");
const UsuarioAgenciaEntrega = require("../models/UsuarioAgenciaEntrega");
const {
  cambiarResponsableEnTransaccion,
  actualizarEstadoEnTransaccion,
} = require("../services/entregaOperacionService");

const args = process.argv.slice(2);
const valorDe = (nombre) => {
  const index = args.indexOf(nombre);
  return index >= 0 ? args[index + 1] : null;
};
const tiene = (nombre) => args.includes(nombre);

const consultarInconsistencias = async () => {
  const filas = await sequelize.query(
    `
      SELECT
        e.id AS "entregaId",
        e.estado,
        COALESCE(e.version, 0) AS version,
        COUNT(uae.id) FILTER (WHERE uae.activo = TRUE) AS "asignacionesActivas",
        MAX(uae.usuario_agencia_id) FILTER (WHERE uae.activo = TRUE) AS "responsableId",
        BOOL_OR(ua.activo = FALSE) FILTER (WHERE uae.activo = TRUE) AS "responsableInactivo"
      FROM entregas e
      LEFT JOIN usuario_agencia_entrega uae ON uae.entrega_id = e.id
      LEFT JOIN usuario_agencia ua ON ua.id = uae.usuario_agencia_id
      WHERE e.activo = TRUE
        AND e.estado NOT IN ('Entregado', 'No Entregado', 'Eliminado')
      GROUP BY e.id, e.estado, e.version
      HAVING COUNT(uae.id) FILTER (WHERE uae.activo = TRUE) <> 1
         OR BOOL_OR(ua.activo = FALSE) FILTER (WHERE uae.activo = TRUE) IS TRUE
      ORDER BY e.id
    `,
    { type: QueryTypes.SELECT },
  );

  return filas.map((fila) => ({
    ...fila,
    problema:
      Number(fila.asignacionesActivas) === 0
        ? "SIN_RESPONSABLE_ACTIVO"
        : Number(fila.asignacionesActivas) > 1
          ? "MULTIPLES_RESPONSABLES_ACTIVOS"
          : "RESPONSABLE_INACTIVO",
  }));
};

const leerPlan = (archivo) => {
  const ruta = path.resolve(process.cwd(), archivo);
  const contenido = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const operaciones = Array.isArray(contenido) ? contenido : contenido.operaciones;
  if (!Array.isArray(operaciones) || operaciones.length === 0) {
    throw new Error("El archivo debe contener un arreglo no vacío de operaciones.");
  }
  return operaciones;
};

const validarOperacion = (operacion) => {
  for (const campo of ["entregaId", "responsableDestinoId", "expectedVersion", "motivo"]) {
    if (operacion[campo] === undefined || operacion[campo] === null || operacion[campo] === "") {
      throw new Error(`Falta ${campo} en una operación del plan.`);
    }
  }
};

const mismosIds = (actuales, esperados) => {
  const ordenar = (items) => items.map(Number).sort((a, b) => a - b);
  return JSON.stringify(ordenar(actuales)) === JSON.stringify(ordenar(esperados || []));
};

const aplicarPlan = async ({ operaciones, actorUsuarioId }) => {
  const reconciliacionId = randomUUID();
  const transaction = await sequelize.transaction();
  try {
    for (const operacion of operaciones) {
      validarOperacion(operacion);
      const asignacionesAnteriores = await UsuarioAgenciaEntrega.findAll({
        where: { entrega_id: operacion.entregaId, activo: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      let anterior = asignacionesAnteriores[0] || null;
      if (asignacionesAnteriores.length > 1) {
        const idsActuales = asignacionesAnteriores.map((item) => item.id);
        if (!mismosIds(idsActuales, operacion.asignacionesActivasEsperadas)) {
          throw new Error(
            `Entrega ${operacion.entregaId}: indique exactamente asignacionesActivasEsperadas (${idsActuales.join(",")}).`,
          );
        }
        anterior = asignacionesAnteriores.find(
          (item) => Number(item.id) === Number(operacion.asignacionAnteriorIdParaReversion),
        );
        if (!anterior) {
          throw new Error(
            `Entrega ${operacion.entregaId}: elija asignacionAnteriorIdParaReversion dentro de las asignaciones esperadas.`,
          );
        }
        for (const asignacion of asignacionesAnteriores) {
          await asignacion.update(
            {
              activo: false,
              estado: "Reconciliada",
              fecha_desasignacion: new Date(),
            },
            { transaction },
          );
        }
      }
      const entregaAnterior = await Entrega.findByPk(operacion.entregaId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!entregaAnterior) throw new Error(`Entrega ${operacion.entregaId} no encontrada.`);

      const estadoAnterior = entregaAnterior.estado;
      const versionAnterior = Number(entregaAnterior.version);
      const cambioResponsable = await cambiarResponsableEnTransaccion({
        entregaId: operacion.entregaId,
        usuarioAgenciaId: operacion.responsableDestinoId,
        expectedVersion: operacion.expectedVersion,
        actorUsuarioId,
        motivo: operacion.motivo,
        idempotencyKey: `reconciliacion:${reconciliacionId}:${operacion.entregaId}:responsable`,
        forzarReasignacion: true,
        transaction,
      });

      let versionNueva = Number(cambioResponsable.entrega.version);
      let estadoNuevo = cambioResponsable.entrega.estado;
      if (operacion.estadoVerificado && operacion.estadoVerificado !== estadoNuevo) {
        const cambioEstado = await actualizarEstadoEnTransaccion({
          entregaId: operacion.entregaId,
          nuevoEstado: operacion.estadoVerificado,
          expectedVersion: versionNueva,
          actorUsuarioId,
          motivo: operacion.motivo,
          idempotencyKey: `reconciliacion:${reconciliacionId}:${operacion.entregaId}:estado`,
          transaction,
        });
        versionNueva = Number(cambioEstado.entrega.version);
        estadoNuevo = cambioEstado.entrega.estado;
      }

      if (asignacionesAnteriores.length > 1) {
        await EntregaEvento.create(
          {
            entregaId: operacion.entregaId,
            tipo: "RECONCILIACION_APLICADA",
            estadoAnterior,
            estadoNuevo,
            usuarioAgenciaAnteriorId: anterior.usuario_agencia_id,
            usuarioAgenciaNuevoId: operacion.responsableDestinoId,
            actorUsuarioId,
            motivo: operacion.motivo,
            idempotencyKey: `reconciliacion:${reconciliacionId}:${operacion.entregaId}:duplicados`,
            metadata: {
              asignacionesAnteriores: asignacionesAnteriores.map((item) => ({
                id: item.id,
                usuarioAgenciaId: item.usuario_agencia_id,
              })),
              asignacionAnteriorIdParaReversion: anterior.id,
            },
          },
          { transaction },
        );
      }

      await sequelize.query(
        `INSERT INTO entrega_reconciliaciones
          ("reconciliacionId", "entregaId", "asignacionAnteriorId", "asignacionesAnteriores", "asignacionNuevaId",
           "estadoAnterior", "estadoNuevo", "versionAnterior", "versionNueva",
           "actorUsuarioId", motivo, revertida, "createdAt")
         VALUES (:reconciliacionId, :entregaId, :asignacionAnteriorId, CAST(:asignacionesAnteriores AS JSONB), :asignacionNuevaId,
           :estadoAnterior, :estadoNuevo, :versionAnterior, :versionNueva,
           :actorUsuarioId, :motivo, FALSE, NOW())`,
        {
          replacements: {
            reconciliacionId,
            entregaId: operacion.entregaId,
            asignacionAnteriorId: anterior?.id || null,
            asignacionesAnteriores: JSON.stringify(
              asignacionesAnteriores.map((item) => ({
                id: item.id,
                usuarioAgenciaId: item.usuario_agencia_id,
              })),
            ),
            asignacionNuevaId: cambioResponsable.asignacion.id,
            estadoAnterior,
            estadoNuevo,
            versionAnterior,
            versionNueva,
            actorUsuarioId,
            motivo: operacion.motivo,
          },
          transaction,
        },
      );
    }
    await transaction.commit();
    return reconciliacionId;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const revertir = async ({ reconciliacionId, actorUsuarioId, motivo }) => {
  const transaction = await sequelize.transaction();
  try {
    const registros = await sequelize.query(
      `SELECT * FROM entrega_reconciliaciones
       WHERE "reconciliacionId" = :reconciliacionId AND revertida = FALSE
       ORDER BY id DESC FOR UPDATE`,
      { replacements: { reconciliacionId }, type: QueryTypes.SELECT, transaction },
    );
    if (!registros.length) throw new Error("Reconciliación inexistente o ya revertida.");

    for (const registro of registros) {
      const entrega = await Entrega.findByPk(registro.entregaId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const actual = await UsuarioAgenciaEntrega.findOne({
        where: { entrega_id: registro.entregaId, activo: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        Number(entrega.version) !== Number(registro.versionNueva) ||
        Number(actual?.id) !== Number(registro.asignacionNuevaId)
      ) {
        throw new Error(
          `No se puede revertir entrega ${registro.entregaId}: cambió después de la reconciliación.`,
        );
      }

      if (actual) {
        await actual.update(
          { activo: false, estado: "Reconciliacion revertida", fecha_desasignacion: new Date() },
          { transaction },
        );
      }
      let responsableRestauradoId = null;
      if (registro.asignacionAnteriorId) {
        const anterior = await UsuarioAgenciaEntrega.findByPk(registro.asignacionAnteriorId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!anterior) throw new Error(`Asignación histórica ${registro.asignacionAnteriorId} no encontrada.`);
        await anterior.update(
          { activo: true, estado: "Asignada", fecha_desasignacion: null },
          { transaction },
        );
        responsableRestauradoId = anterior.usuario_agencia_id;
      }

      const versionReversion = Number(entrega.version) + 1;
      await entrega.update(
        { estado: registro.estadoAnterior, version: versionReversion },
        { transaction },
      );
      await EntregaEvento.create(
        {
          entregaId: entrega.id,
          tipo: "RECONCILIACION_REVERTIDA",
          estadoAnterior: registro.estadoNuevo,
          estadoNuevo: registro.estadoAnterior,
          usuarioAgenciaAnteriorId: actual?.usuario_agencia_id || null,
          usuarioAgenciaNuevoId: responsableRestauradoId,
          actorUsuarioId,
          motivo,
          idempotencyKey: `reversion:${reconciliacionId}:${entrega.id}`,
          metadata: { reconciliacionId },
        },
        { transaction },
      );
      await sequelize.query(
        `UPDATE entrega_reconciliaciones
         SET revertida = TRUE, "revertedAt" = NOW()
         WHERE id = :id`,
        { replacements: { id: registro.id }, transaction },
      );
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const main = async () => {
  await sequelize.authenticate();
  if (valorDe("--revert")) {
    if (!tiene("--apply")) throw new Error("La reversión exige --apply.");
    const actorUsuarioId = Number(valorDe("--actor"));
    const motivo = valorDe("--motivo");
    if (!actorUsuarioId || !motivo) throw new Error("La reversión exige --actor y --motivo.");
    await revertir({ reconciliacionId: valorDe("--revert"), actorUsuarioId, motivo });
    console.log("Reconciliación revertida de forma transaccional.");
    return;
  }

  const inconsistencias = await consultarInconsistencias();
  console.table(inconsistencias);
  if (!tiene("--apply")) {
    console.log(`DRY-RUN: ${inconsistencias.length} inconsistencia(s). No se modificaron datos.`);
    return;
  }

  const archivo = valorDe("--mapping");
  const actorUsuarioId = Number(valorDe("--actor"));
  if (!archivo || !actorUsuarioId) {
    throw new Error("La aplicación exige --mapping <archivo.json> y --actor <usuarioId>.");
  }
  const operaciones = leerPlan(archivo);
  const reconciliacionId = await aplicarPlan({ operaciones, actorUsuarioId });
  console.log(`Reconciliación aplicada: ${reconciliacionId}`);
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close());
}

module.exports = {
  aplicarPlan,
  consultarInconsistencias,
  leerPlan,
  mismosIds,
  revertir,
  validarOperacion,
};
