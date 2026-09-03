const CopaCreditekVendedorConfiguracion = require(
  "../../models/Marketing/CopaCreditekVendedorConfiguracion",
);
const CopaCreditekSemanaVendedor = require(
  "../../models/Marketing/CopaCreditekSemanaVendedor",
);
const { sequelize } = require("../../config/db");
const {
  esVendedorActivo,
  normalizarConfiguracionCompleta,
  normalizarEnteroNoNegativo,
  normalizarEquipoCopa,
  obtenerMarcador,
  obtenerVendedoresActivos,
  validarPeriodo,
} = require("../../services/copaCreditekService");

const obtenerPeriodoValido = (datos) => {
  const validacion = validarPeriodo(datos.fechaInicio, datos.fechaFin);
  if (!validacion.valido) {
    const error = new Error(validacion.mensaje);
    error.status = 400;
    throw error;
  }
  return validacion;
};

const asegurarVendedor = async (usuarioId) => {
  if (!(await esVendedorActivo(usuarioId))) {
    const error = new Error("El usuario indicado no es un vendedor activo.");
    error.status = 404;
    throw error;
  }
  return Number(usuarioId);
};

const obtenerOCrearSemana = (usuarioId, fechaInicio, fechaFin) =>
  CopaCreditekSemanaVendedor.findOrCreate({
    where: { usuarioId, fechaInicio, fechaFin },
    defaults: { meta: 0, ventasManual: null },
  }).then(([semana]) => semana);

const manejarError = (res, error, mensaje) => {
  if (error.status) {
    return res.status(error.status).json({ ok: false, message: error.message });
  }
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      ok: false,
      message: error.errors?.[0]?.message || "Los datos no son válidos.",
    });
  }
  console.error(mensaje, error);
  return res.status(500).json({ ok: false, message: mensaje });
};

exports.obtener = async (req, res) => {
  try {
    const periodo = obtenerPeriodoValido(req.query);
    const marcador = await obtenerMarcador(periodo);
    return res.json({ ok: true, ...marcador });
  } catch (error) {
    return manejarError(res, error, "No se pudo cargar la Copa Creditek.");
  }
};

exports.actualizarConfiguracion = async (req, res) => {
  try {
    const usuarioId = await asegurarVendedor(req.params.usuarioId);
    const aliasInformado = Object.prototype.hasOwnProperty.call(req.body, "alias");
    const equipoInformado = Object.prototype.hasOwnProperty.call(
      req.body,
      "equipoCopa",
    );
    const visibilidadInformada = Object.prototype.hasOwnProperty.call(
      req.body,
      "mostrarEnMarcador",
    );

    if (!aliasInformado && !equipoInformado && !visibilidadInformada) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar el alias, el equipo Copa o la visibilidad.",
      });
    }

    const cambios = {};
    if (aliasInformado) {
      const alias = String(req.body.alias || "").trim();
      if (alias.length > 50) {
        return res.status(400).json({
          ok: false,
          message: "El alias no puede superar 50 caracteres.",
        });
      }
      cambios.alias = alias || null;
    }

    if (equipoInformado) {
      const valor = String(req.body.equipoCopa || "").trim();
      const equipoCopa = valor ? normalizarEquipoCopa(valor) : null;
      if (valor && !equipoCopa) {
        return res.status(400).json({
          ok: false,
          message: "El equipo Copa seleccionado no es válido.",
        });
      }
      cambios.equipoCopa = equipoCopa;
    }

    if (visibilidadInformada) {
      if (typeof req.body.mostrarEnMarcador !== "boolean") {
        return res.status(400).json({
          ok: false,
          message: "La visibilidad del vendedor no es válida.",
        });
      }
      cambios.mostrarEnMarcador = req.body.mostrarEnMarcador;
    }

    let configuracion = await CopaCreditekVendedorConfiguracion.findOne({
      where: { usuarioId },
    });
    if (configuracion) {
      await configuracion.update(cambios);
    } else {
      configuracion = await CopaCreditekVendedorConfiguracion.create({
        usuarioId,
        ...cambios,
      });
    }

    return res.json({ ok: true, configuracion });
  } catch (error) {
    return manejarError(
      res,
      error,
      "No se pudo guardar la configuración del vendedor.",
    );
  }
};

exports.actualizarMeta = async (req, res) => {
  try {
    const usuarioId = await asegurarVendedor(req.params.usuarioId);
    const { fechaInicio, fechaFin } = obtenerPeriodoValido(req.body);
    const meta = normalizarEnteroNoNegativo(req.body.meta, "La meta");
    if (!meta.valido) {
      return res.status(400).json({ ok: false, message: meta.mensaje });
    }

    const semana = await obtenerOCrearSemana(usuarioId, fechaInicio, fechaFin);
    await semana.update({ meta: meta.valor });
    return res.json({ ok: true, semana });
  } catch (error) {
    return manejarError(res, error, "No se pudo guardar la meta semanal.");
  }
};

exports.actualizarVentasManual = async (req, res) => {
  try {
    const usuarioId = await asegurarVendedor(req.params.usuarioId);
    const { fechaInicio, fechaFin } = obtenerPeriodoValido(req.body);
    const ventasManual = normalizarEnteroNoNegativo(
      req.body.ventasManual,
      "Las ventas manuales",
    );
    if (!ventasManual.valido) {
      return res
        .status(400)
        .json({ ok: false, message: ventasManual.mensaje });
    }

    const semana = await obtenerOCrearSemana(usuarioId, fechaInicio, fechaFin);
    await semana.update({ ventasManual: ventasManual.valor });
    return res.json({ ok: true, semana });
  } catch (error) {
    return manejarError(
      res,
      error,
      "No se pudo guardar el valor manual de ventas.",
    );
  }
};

exports.restaurarVentasAutomaticas = async (req, res) => {
  try {
    const usuarioId = await asegurarVendedor(req.params.usuarioId);
    const { fechaInicio, fechaFin } = obtenerPeriodoValido(req.query);
    const semana = await obtenerOCrearSemana(usuarioId, fechaInicio, fechaFin);
    await semana.update({ ventasManual: null });
    return res.json({ ok: true, semana });
  } catch (error) {
    return manejarError(
      res,
      error,
      "No se pudo restaurar el valor automático de ventas.",
    );
  }
};

exports.guardarConfiguracionCompleta = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = obtenerPeriodoValido(req.body);
    const filas = req.body.vendedores;
    if (!Array.isArray(filas) || filas.length === 0 || filas.length > 500) {
      return res.status(400).json({
        ok: false,
        message: "Debes enviar entre 1 y 500 vendedores.",
      });
    }

    const normalizadas = [];
    const idsRecibidos = new Set();
    for (const fila of filas) {
      const resultado = normalizarConfiguracionCompleta(fila);
      if (!resultado.valido) {
        return res.status(400).json({
          ok: false,
          message: resultado.mensaje,
          usuarioId: fila?.usuarioId || null,
        });
      }
      if (idsRecibidos.has(resultado.valor.usuarioId)) {
        return res.status(400).json({
          ok: false,
          message: "No se puede guardar dos veces al mismo vendedor.",
        });
      }
      idsRecibidos.add(resultado.valor.usuarioId);
      normalizadas.push(resultado.valor);
    }

    const vendedoresActivos = await obtenerVendedoresActivos();
    const idsVendedoresActivos = new Set(
      vendedoresActivos.map((vendedor) => Number(vendedor.id)),
    );
    const vendedorInvalido = normalizadas.find(
      (fila) => !idsVendedoresActivos.has(fila.usuarioId),
    );
    if (vendedorInvalido) {
      return res.status(404).json({
        ok: false,
        message: "Uno de los usuarios ya no es un vendedor activo.",
        usuarioId: vendedorInvalido.usuarioId,
      });
    }

    await sequelize.transaction(async (transaction) => {
      for (const fila of normalizadas) {
        await CopaCreditekVendedorConfiguracion.upsert(
          {
            usuarioId: fila.usuarioId,
            alias: fila.alias,
            equipoCopa: fila.equipoCopa,
            mostrarEnMarcador: fila.mostrarEnMarcador,
          },
          { transaction },
        );
        await CopaCreditekSemanaVendedor.upsert(
          {
            usuarioId: fila.usuarioId,
            fechaInicio,
            fechaFin,
            meta: fila.meta,
            ventasManual: fila.ventasManual,
          },
          { transaction },
        );
      }
    });

    return res.json({
      ok: true,
      actualizados: normalizadas.length,
      message: "Configuración completa guardada.",
    });
  } catch (error) {
    return manejarError(
      res,
      error,
      "No se pudo guardar la configuración completa.",
    );
  }
};
