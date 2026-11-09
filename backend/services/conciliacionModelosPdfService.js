const ConciliacionModeloTv = require("../models/ConciliacionModeloTv");
const ConciliacionModeloCelular = require("../models/ConciliacionModeloCelular");
const { sequelize } = require("../config/db");

const normalizarCodigoPdf = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const acumularModelos = (registros, obtenerCampos) => {
  const modelos = new Map();

  for (const registro of registros) {
    const { codigoPdf, archivoOrigen } = obtenerCampos(registro);
    const codigoLimpio = String(codigoPdf || "").trim();
    const codigoNormalizado = normalizarCodigoPdf(codigoLimpio);
    if (!codigoNormalizado) continue;

    const actual = modelos.get(codigoNormalizado) || {
      codigoPdf: codigoLimpio,
      codigoNormalizado,
      vecesDetectado: 0,
      archivosOrigen: new Set(),
    };

    actual.vecesDetectado += 1;
    if (archivoOrigen) actual.archivosOrigen.add(String(archivoOrigen).trim());
    modelos.set(codigoNormalizado, actual);
  }

  return [...modelos.values()].map((modelo) => ({
    ...modelo,
    archivosOrigen: [...modelo.archivosOrigen].filter(Boolean),
  }));
};

const extraerModelosDesdeResultado = (resultado) => {
  const registros = Array.isArray(resultado?.registros_validos)
    ? resultado.registros_validos
    : [];
  const errores = Array.isArray(resultado?.errores) ? resultado.errores : [];

  return acumularModelos([...registros, ...errores], (registro) => ({
    codigoPdf: registro.codigo_pdf,
    archivoOrigen: registro.archivo_origen,
  }));
};

const extraerModelosDesdeVentas = (registros = []) =>
  acumularModelos(registros, (registro) => ({
    codigoPdf: registro.MODELO ?? registro.modelo,
    archivoOrigen: registro.ARCHIVO ?? registro.archivo,
  }));

const guardarModelosDetectados = async ({
  ModeloMapeo,
  modelosDetectados,
  origen,
  transaction,
}) => {
  let nuevos = 0;
  let actualizados = 0;

  for (const item of modelosDetectados) {
    const existente = await ModeloMapeo.findOne({
      where: { codigoNormalizado: item.codigoNormalizado },
      transaction,
    });

    if (!existente) {
      await ModeloMapeo.create(
        {
          origen,
          codigoPdf: item.codigoPdf,
          codigoNormalizado: item.codigoNormalizado,
          vecesDetectado: item.vecesDetectado,
          archivosOrigen: item.archivosOrigen,
          estado: "PENDIENTE",
          observacion: "Modelo extraido de PDF pendiente de mapeo",
        },
        { transaction },
      );
      nuevos += 1;
      continue;
    }

    const archivosOrigen = new Set([
      ...(Array.isArray(existente.archivosOrigen) ? existente.archivosOrigen : []),
      ...item.archivosOrigen,
    ]);

    await existente.update(
      {
        codigoPdf: existente.codigoPdf || item.codigoPdf,
        vecesDetectado:
          Number(existente.vecesDetectado || 0) + item.vecesDetectado,
        archivosOrigen: [...archivosOrigen],
      },
      { transaction },
    );
    actualizados += 1;
  }

  return { nuevos, actualizados };
};

const sincronizarModelosDesdeVentas = async ({
  ventasTv = [],
  ventasCelular = [],
}) => {
  const modelosTv = extraerModelosDesdeVentas(ventasTv);
  const modelosCelular = extraerModelosDesdeVentas(ventasCelular);

  return sequelize.transaction(async (transaction) => {
    const tv = await guardarModelosDetectados({
      ModeloMapeo: ConciliacionModeloTv,
      modelosDetectados: modelosTv,
      origen: "PDF_CREDITV",
      transaction,
    });
    const celular = await guardarModelosDetectados({
      ModeloMapeo: ConciliacionModeloCelular,
      modelosDetectados: modelosCelular,
      origen: "PDF_UPHONE",
      transaction,
    });

    return {
      tv: { detectados: modelosTv.length, ...tv },
      celular: { detectados: modelosCelular.length, ...celular },
    };
  });
};

module.exports = {
  extraerModelosDesdeResultado,
  extraerModelosDesdeVentas,
  guardarModelosDetectados,
  normalizarCodigoPdf,
  sincronizarModelosDesdeVentas,
};
