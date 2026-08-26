const Agencia = require("../models/Agencia");
const ReporteCajaUsuarioAgencia = require("../models/ReporteCajaUsuarioAgencia");

const MAPEO_INICIAL = [
  { usuario: "ALEXFER", agencia: "NUEVA AURORA" },
  { usuario: "GABYMATRIZ", agencia: "NUEVA AURORA" },
  { usuario: "GABYCAUP", agencia: "NUEVA AURORA" },
  { usuario: "GABYSANGO", agencia: "NUEVA AURORA" },
  { usuario: "GABYCHILLO", agencia: "NUEVA AURORA" },
  { usuario: "DAMIZA", agencia: "CAUPICHO" },
  { usuario: "CHAVICTK", agencia: "SANGOLQUI" },
];

const normalizar = (value) => String(value || "").trim().toUpperCase();

const seedReporteCajaUsuarioAgencia = async () => {
  const total = await ReporteCajaUsuarioAgencia.count();
  if (total > 0) return { creados: 0 };

  const agencias = await Agencia.findAll({
    where: { activo: true },
    attributes: ["id", "nombre"],
  });
  const agenciasPorNombre = new Map(
    agencias.map((agencia) => [normalizar(agencia.nombre), agencia.id]),
  );
  const registros = MAPEO_INICIAL.map((item) => ({
    codigoUsuario: item.usuario,
    agenciaId: agenciasPorNombre.get(item.agencia),
    fechaDesde: "2000-01-01",
    fechaHasta: null,
    activo: true,
  })).filter((item) => item.agenciaId);

  if (registros.length) {
    await ReporteCajaUsuarioAgencia.bulkCreate(registros, {
      ignoreDuplicates: true,
    });
  }

  return { creados: registros.length };
};

const obtenerMapeoReporteCaja = async () => {
  const configuraciones = await ReporteCajaUsuarioAgencia.findAll({
    where: { activo: true },
    attributes: ["codigoUsuario", "fechaDesde", "fechaHasta"],
    include: [
      {
        model: Agencia,
        as: "agencia",
        where: { activo: true },
        attributes: ["nombre"],
        required: true,
      },
    ],
  });

  return configuraciones
    .map((item) => ({
      usuario: normalizar(item.codigoUsuario),
      agencia: normalizar(item.agencia?.nombre),
      fechaDesde: item.fechaDesde,
      fechaHasta: item.fechaHasta,
    }))
    .filter((item) => item.usuario && item.agencia)
    .sort(
      (a, b) =>
        b.usuario.length - a.usuario.length ||
        String(b.fechaDesde).localeCompare(String(a.fechaDesde)),
    );
};

module.exports = {
  MAPEO_INICIAL,
  obtenerMapeoReporteCaja,
  seedReporteCajaUsuarioAgencia,
};
