const { Op, QueryTypes, col, fn, where } = require("sequelize");
const Cliente = require("../models/Cliente");
const DetalleVenta = require("../models/DetalleVenta");
const Venta = require("../models/Venta");
const { sequelize } = require("../config/db");

const LONGITUDES_CEDULA_VALIDAS = new Set([10, 13]);

const normalizarCedula = (valor) => {
  const digitos = String(valor ?? "").replace(/[^0-9]/g, "");
  return LONGITUDES_CEDULA_VALIDAS.has(digitos.length) ? digitos : null;
};

const normalizarComparable = (valor) =>
  String(valor ?? "").trim().replace(/\s+/g, " ").toUpperCase();

const deduplicarVentas = (ventas = []) => {
  const unicas = new Map();
  ventas.forEach((venta) => {
    if (venta?.id != null) unicas.set(String(venta.id), venta);
  });
  return [...unicas.values()];
};

const detallesDeVenta = (venta) => venta?.detalleVenta || [];

const seleccionarVentaInequivoca = (ventas = [], detalleEntrega = {}) => {
  const candidatas = deduplicarVentas(ventas);

  if (candidatas.length === 0) {
    return { venta: null, ambigua: false, criterio: null, cantidad: 0 };
  }

  if (candidatas.length === 1) {
    return {
      venta: candidatas[0],
      ambigua: false,
      criterio: "CLIENTE",
      cantidad: 1,
    };
  }

  let acotadas = candidatas;
  const contrato = normalizarComparable(detalleEntrega.contrato);

  if (contrato) {
    const porContrato = acotadas.filter((venta) =>
      detallesDeVenta(venta).some(
        (detalle) => normalizarComparable(detalle.contrato) === contrato,
      ),
    );

    if (porContrato.length === 1) {
      return {
        venta: porContrato[0],
        ambigua: false,
        criterio: "CONTRATO",
        cantidad: 1,
      };
    }

    if (porContrato.length > 1) acotadas = porContrato;
  }

  const modeloId = Number(detalleEntrega.modeloId);
  if (Number.isInteger(modeloId) && modeloId > 0) {
    const porModelo = acotadas.filter((venta) =>
      detallesDeVenta(venta).some(
        (detalle) => Number(detalle.modeloId) === modeloId,
      ),
    );

    if (porModelo.length === 1) {
      return {
        venta: porModelo[0],
        ambigua: false,
        criterio: "MODELO",
        cantidad: 1,
      };
    }

    if (porModelo.length > 1) acotadas = porModelo;
  }

  return {
    venta: null,
    ambigua: true,
    criterio: null,
    cantidad: acotadas.length,
  };
};

const includeDetallesVenta = [
  {
    model: DetalleVenta,
    as: "detalleVenta",
    attributes: ["contrato", "modeloId"],
    required: false,
  },
];

const buscarVentasActivasPorCliente = (clienteId, transaction) =>
  Venta.findAll({
    where: { clienteId, activo: true },
    attributes: ["id", "clienteId", "fecha"],
    include: includeDetallesVenta,
    order: [
      ["fecha", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });

const buscarVentasActivasPorCedula = async (cedula, transaction) => {
  const cedulaNormalizada = normalizarCedula(cedula);
  if (!cedulaNormalizada) return [];

  const clientes = await Cliente.findAll({
    where: where(
      fn(
        "REGEXP_REPLACE",
        fn("COALESCE", col("cedula"), ""),
        "[^0-9]",
        "",
        "g",
      ),
      cedulaNormalizada,
    ),
    attributes: ["id"],
    transaction,
  });

  const clienteIds = clientes.map((cliente) => cliente.id);
  if (clienteIds.length === 0) return [];

  return Venta.findAll({
    where: {
      clienteId: { [Op.in]: clienteIds },
      activo: true,
    },
    attributes: ["id", "clienteId", "fecha"],
    include: includeDetallesVenta,
    order: [
      ["fecha", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
};

const resolverVentaParaEntrega = async ({
  clienteId,
  cedula,
  detalle,
  transaction,
}) => {
  const porCliente = await buscarVentasActivasPorCliente(clienteId, transaction);
  const origenCandidatas = porCliente.length > 0 ? "CLIENTE_ID" : "CEDULA";
  const candidatas =
    porCliente.length > 0
      ? porCliente
      : await buscarVentasActivasPorCedula(cedula, transaction);
  const seleccion = seleccionarVentaInequivoca(candidatas, detalle);

  if (seleccion.venta) {
    return {
      ventaId: seleccion.venta.id,
      tipoCoincidencia: origenCandidatas,
      criterioDesambiguacion:
        seleccion.criterio === "CLIENTE" ? null : seleccion.criterio,
      ambigua: false,
      cantidadCandidatas: 1,
      advertencia: null,
    };
  }

  if (seleccion.ambigua) {
    return {
      ventaId: null,
      tipoCoincidencia: origenCandidatas,
      criterioDesambiguacion: null,
      ambigua: true,
      cantidadCandidatas: seleccion.cantidad,
      advertencia: {
        codigo: "VENTA_AMBIGUA",
        message:
          "La entrega fue creada sin relacionar una venta porque existen varias candidatas.",
        cantidadCandidatas: seleccion.cantidad,
      },
    };
  }

  return {
    ventaId: null,
    tipoCoincidencia: null,
    criterioDesambiguacion: null,
    ambigua: false,
    cantidadCandidatas: 0,
    advertencia: null,
  };
};

const SQL_CONTROL_FINANCIERO_POR_VENTA = `
  detalle_control AS (
    SELECT
      detalle."ventaId",
      detalle.referencia_pdf_normalizada,
      detalle.contrato_normalizado,
      (
        LOWER(COALESCE(dispositivo.nombre, '')) LIKE '%celular%'
        OR LOWER(COALESCE(dispositivo.nombre, '')) LIKE '%telefono%'
        OR LOWER(COALESCE(dispositivo.nombre, '')) LIKE '%smartphone%'
      ) AS es_celular,
      (
        LOWER(TRIM(COALESCE(dispositivo.nombre, ''))) = 'tv'
        OR LOWER(COALESCE(dispositivo.nombre, '')) LIKE '%televisor%'
        OR LOWER(COALESCE(dispositivo.nombre, '')) LIKE '%television%'
      ) AS es_tv
    FROM detalle_ventas detalle
    INNER JOIN ventas venta
      ON venta.id = detalle."ventaId"
      AND venta.activo IS TRUE
    LEFT JOIN "DispositivoMarcas" dispositivo_marca
      ON dispositivo_marca.id = detalle."dispositivoMarcaId"
    LEFT JOIN dispositivos dispositivo
      ON dispositivo.id = dispositivo_marca.dispositivo_id
  ),
  control_candidatos AS (
    SELECT
      detalle."ventaId",
      elegido.id AS "controlFinancieroRegistroId",
      elegido.fecha AS "fechaControlOriginal",
      elegido.fecha_normalizada AS "fechaControlLocal",
      elegido.prioridad
    FROM detalle_control detalle
    CROSS JOIN LATERAL (
      SELECT candidato.*
      FROM (
        SELECT
          registro.id,
          registro.fecha,
          registro.fecha_normalizada,
          0 AS prioridad
        FROM control_financiero_registros registro
        INNER JOIN control_financiero_cargas carga
          ON carga.id = registro."cargaId"
          AND carga.estado = 'ACTIVA'
        WHERE detalle.referencia_pdf_normalizada IS NOT NULL
          AND registro."tipoRegistro" = 'VENTA_CELULAR'
          AND registro.imei_normalizado = detalle.referencia_pdf_normalizada
          AND registro.fecha_normalizada IS NOT NULL

        UNION ALL

        SELECT
          registro.id,
          registro.fecha,
          registro.fecha_normalizada,
          1 AS prioridad
        FROM control_financiero_registros registro
        INNER JOIN control_financiero_cargas carga
          ON carga.id = registro."cargaId"
          AND carga.estado = 'ACTIVA'
        WHERE detalle.contrato_normalizado IS NOT NULL
          AND registro.contrato_normalizado = detalle.contrato_normalizado
          AND registro.fecha_normalizada IS NOT NULL
          AND (
            (registro."tipoRegistro" = 'VENTA_CELULAR' AND detalle.es_celular)
            OR (registro."tipoRegistro" = 'VENTA_TV' AND detalle.es_tv)
          )
          AND NOT (
            registro."tipoRegistro" = 'VENTA_CELULAR'
            AND detalle.referencia_pdf_normalizada IS NOT NULL
            AND registro.imei_normalizado = detalle.referencia_pdf_normalizada
          )
      ) candidato
      ORDER BY
        candidato.prioridad,
        candidato.fecha_normalizada DESC,
        candidato.id DESC
      LIMIT 1
    ) elegido
  ),
  control_por_venta AS (
    SELECT
      "ventaId",
      "controlFinancieroRegistroId",
      "fechaControlOriginal",
      "fechaControlLocal"
    FROM (
      SELECT
        candidato.*,
        ROW_NUMBER() OVER (
          PARTITION BY candidato."ventaId"
          ORDER BY
            candidato.prioridad,
            candidato."fechaControlLocal" DESC,
            candidato."controlFinancieroRegistroId" DESC
        ) AS orden
      FROM control_candidatos candidato
    ) ordenados
    WHERE orden = 1
  )
`;

const SQL_INFORME_VENTAS_CON_ENTREGA = `
  WITH ${SQL_CONTROL_FINANCIERO_POR_VENTA},
  ventas_filtradas AS (
    SELECT
      v.id AS "ventaId",
      v.fecha AS "fechaVenta",
      control."controlFinancieroRegistroId",
      control."fechaControlOriginal",
      control."fechaControlLocal" AT TIME ZONE 'America/Guayaquil'
        AS "fechaControlFinanciero",
      v."clienteId",
      cliente_venta.cliente,
      cliente_venta.cedula,
      cliente_venta.telefono,
      ua."agenciaId",
      agencia.nombre AS agencia,
      ua."usuarioId" AS "vendedorId",
      usuario.nombre AS vendedor,
      v."origenId",
      origen.nombre AS origen,
      cliente_venta.cedula_normalizada AS "cedulaNormalizada"
    FROM control_por_venta control
    CROSS JOIN LATERAL (
      SELECT venta.*
      FROM ventas venta
      WHERE venta.id = control."ventaId"
        AND venta.activo IS TRUE
      OFFSET 0
    ) v
    INNER JOIN clientes cliente_venta ON cliente_venta.id = v."clienteId"
    INNER JOIN usuario_agencia ua ON ua.id = v."usuarioAgenciaId"
    LEFT JOIN agencias agencia ON agencia.id = ua."agenciaId"
    LEFT JOIN usuarios usuario ON usuario.id = ua."usuarioId"
    LEFT JOIN origenes origen ON origen.id = v."origenId"
    WHERE v.activo IS TRUE
      AND (
        :fechaInicio IS NULL
        OR control."fechaControlLocal" >= CAST(:fechaInicio AS DATE)
      )
      AND (
        :fechaFin IS NULL
        OR control."fechaControlLocal" < CAST(:fechaFin AS DATE) + INTERVAL '1 day'
      )
      AND (
        :horaRegistroDesde IS NULL
        OR control."fechaControlLocal"::TIME >= CAST(:horaRegistroDesde AS TIME)
      )
      AND (
        :agenciaIds IS NULL
        OR ua."agenciaId" = ANY(
          string_to_array(:agenciaIds, ',')::INTEGER[]
        )
      )
      AND (
        :vendedorIds IS NULL
        OR ua."usuarioId" = ANY(
          string_to_array(:vendedorIds, ',')::INTEGER[]
        )
      )
      AND (:origenId IS NULL OR v."origenId" = :origenId)
      AND (
        :soloOrigenEntrega IS FALSE
        OR LOWER(TRIM(COALESCE(origen.nombre, ''))) = 'entrega'
      )
      AND (
        :busqueda IS NULL
        OR cliente_venta.cliente ILIKE '%' || :busqueda || '%'
        OR cliente_venta.cedula ILIKE '%' || :busqueda || '%'
      )
  ),
  ventas_por_cedula AS (
    SELECT
      cliente.cedula_normalizada AS "cedulaNormalizada",
      COUNT(DISTINCT venta.id)::INTEGER AS "cantidadVentas"
    FROM clientes cliente
    INNER JOIN ventas venta ON venta."clienteId" = cliente.id
    WHERE venta.activo IS TRUE
      AND LENGTH(cliente.cedula_normalizada) IN (10, 13)
    GROUP BY cliente.cedula_normalizada
  ),
  relaciones AS (
    SELECT
      venta."ventaId",
      entrega.id AS "entregaId",
      entrega.fecha AS "fechaEntrega",
      entrega."createdAt" AS "fechaRegistroEntrega",
      entrega.estado AS "estadoEntrega",
      entrega."tipoEntrega",
      'DIRECTA'::TEXT AS "tipoRelacion"
    FROM ventas_filtradas venta
    INNER JOIN entregas entrega ON entrega."ventaId" = venta."ventaId"
    WHERE COALESCE(entrega.activo, TRUE) IS TRUE
      AND (:estadoEntrega IS NULL OR entrega.estado = :estadoEntrega)
      AND (:tipoEntrega IS NULL OR entrega."tipoEntrega" = :tipoEntrega)

    UNION ALL

    SELECT
      venta."ventaId",
      entrega.id AS "entregaId",
      entrega.fecha AS "fechaEntrega",
      entrega."createdAt" AS "fechaRegistroEntrega",
      entrega.estado AS "estadoEntrega",
      entrega."tipoEntrega",
      'POR_CEDULA'::TEXT AS "tipoRelacion"
    FROM ventas_filtradas venta
    INNER JOIN entregas entrega ON entrega."ventaId" IS NULL
    INNER JOIN clientes cliente_entrega ON cliente_entrega.id = entrega."clienteId"
    WHERE COALESCE(entrega.activo, TRUE) IS TRUE
      AND LENGTH(venta."cedulaNormalizada") IN (10, 13)
      AND cliente_entrega.cedula_normalizada = venta."cedulaNormalizada"
      AND (:estadoEntrega IS NULL OR entrega.estado = :estadoEntrega)
      AND (:tipoEntrega IS NULL OR entrega."tipoEntrega" = :tipoEntrega)
  ),
  relaciones_resumen AS (
    SELECT
      relacion."ventaId",
      COUNT(DISTINCT relacion."entregaId")::INTEGER AS "cantidadEntregas",
      BOOL_OR(relacion."tipoRelacion" = 'DIRECTA') AS "tieneDirecta",
      COUNT(DISTINCT relacion."entregaId") FILTER (
        WHERE relacion."tipoRelacion" = 'POR_CEDULA'
      )::INTEGER AS "cantidadEntregasCedula"
    FROM relaciones relacion
    GROUP BY relacion."ventaId"
  ),
  ventas_con_relacion AS (
    SELECT
      venta.*,
      COALESCE(ventas_cedula."cantidadVentas", 0) AS "cantidadVentasCedula",
      resumen."cantidadEntregas",
      CASE WHEN resumen."tieneDirecta" THEN 'DIRECTA' ELSE 'POR_CEDULA' END
        AS "tipoRelacionConsolidada",
      (
        NOT resumen."tieneDirecta"
        AND (
          resumen."cantidadEntregasCedula" > 1
          OR COALESCE(ventas_cedula."cantidadVentas", 0) > 1
        )
      ) AS "relacionAmbiguaConsolidada"
    FROM ventas_filtradas venta
    INNER JOIN relaciones_resumen resumen
      ON resumen."ventaId" = venta."ventaId"
    LEFT JOIN ventas_por_cedula ventas_cedula
      ON ventas_cedula."cedulaNormalizada" = venta."cedulaNormalizada"
  ),
  ventas_paginadas AS (
    SELECT
      venta.*,
      COUNT(*) OVER ()::INTEGER AS "_total",
      COUNT(*) FILTER (
        WHERE venta."tipoRelacionConsolidada" = 'DIRECTA'
      ) OVER ()::INTEGER AS "_totalDirectas",
      COUNT(*) FILTER (
        WHERE venta."tipoRelacionConsolidada" = 'POR_CEDULA'
          AND NOT venta."relacionAmbiguaConsolidada"
      ) OVER ()::INTEGER AS "_totalPorCedula",
      COUNT(*) FILTER (
        WHERE venta."relacionAmbiguaConsolidada"
      ) OVER ()::INTEGER AS "_totalAmbiguas"
    FROM ventas_con_relacion venta
    ORDER BY venta."fechaControlFinanciero" DESC, venta."ventaId" DESC
    LIMIT :limite OFFSET :offset
  ),
  detalles AS (
    SELECT
      detalle."ventaId",
      STRING_AGG(DISTINCT dispositivo.nombre, ', ') AS dispositivo,
      STRING_AGG(DISTINCT marca.nombre, ', ') AS marca,
      STRING_AGG(DISTINCT modelo.nombre, ', ') AS modelo,
      STRING_AGG(DISTINCT forma_pago.nombre, ', ') AS "formaPago",
      SUM(
        COALESCE(
          detalle."precioVenta",
          detalle."precioVendedor",
          detalle."precioUnitario",
          0
        )
      ) AS "precioVenta"
    FROM ventas_paginadas venta
    INNER JOIN detalle_ventas detalle ON detalle."ventaId" = venta."ventaId"
    LEFT JOIN "DispositivoMarcas" dispositivo_marca
      ON dispositivo_marca.id = detalle."dispositivoMarcaId"
    LEFT JOIN dispositivos dispositivo
      ON dispositivo.id = dispositivo_marca.dispositivo_id
    LEFT JOIN marcas marca ON marca.id = dispositivo_marca.marca_id
    LEFT JOIN modelos modelo ON modelo.id = detalle."modeloId"
    LEFT JOIN formas_pago forma_pago ON forma_pago.id = detalle."formaPagoId"
    GROUP BY detalle."ventaId"
  )
  SELECT
    venta.*,
    relacion."entregaId",
    relacion."fechaEntrega",
    relacion."fechaRegistroEntrega",
    relacion."estadoEntrega",
    relacion."tipoEntrega",
    relacion."tipoRelacion",
    detalle.dispositivo,
    detalle.marca,
    detalle.modelo,
    detalle."formaPago",
    detalle."precioVenta"
  FROM ventas_paginadas venta
  INNER JOIN relaciones relacion ON relacion."ventaId" = venta."ventaId"
  LEFT JOIN detalles detalle ON detalle."ventaId" = venta."ventaId"
  ORDER BY venta."fechaControlFinanciero" DESC, venta."ventaId" DESC,
    CASE WHEN relacion."tipoRelacion" = 'DIRECTA' THEN 0 ELSE 1 END,
    relacion."fechaRegistroEntrega" DESC, relacion."entregaId" DESC
`;

const SQL_DASHBOARD_VENTAS_CON_ENTREGA = `
  WITH ${SQL_CONTROL_FINANCIERO_POR_VENTA},
  ventas_base AS (
    SELECT
      v.id AS "ventaId",
      control."fechaControlLocal",
      cliente_venta.cedula_normalizada AS "cedulaNormalizada"
    FROM ventas v
    INNER JOIN clientes cliente_venta ON cliente_venta.id = v."clienteId"
    INNER JOIN usuario_agencia ua ON ua.id = v."usuarioAgenciaId"
    INNER JOIN control_por_venta control ON control."ventaId" = v.id
    LEFT JOIN origenes origen ON origen.id = v."origenId"
    WHERE v.activo IS TRUE
      AND (
        :agenciaIds IS NULL
        OR ua."agenciaId" = ANY(
          string_to_array(:agenciaIds, ',')::INTEGER[]
        )
      )
      AND (
        :vendedorIds IS NULL
        OR ua."usuarioId" = ANY(
          string_to_array(:vendedorIds, ',')::INTEGER[]
        )
      )
      AND (:origenId IS NULL OR v."origenId" = :origenId)
      AND (
        :soloOrigenEntrega IS FALSE
        OR LOWER(TRIM(COALESCE(origen.nombre, ''))) = 'entrega'
      )
  ),
  relaciones_dashboard AS (
    SELECT
      venta."ventaId",
      venta."fechaControlLocal",
      entrega.id AS "entregaId",
      entrega."createdAt" AS "fechaRegistroEntrega"
    FROM ventas_base venta
    INNER JOIN entregas entrega ON entrega."ventaId" = venta."ventaId"
    WHERE COALESCE(entrega.activo, TRUE) IS TRUE
      AND (:estadoEntrega IS NULL OR entrega.estado = :estadoEntrega)
      AND (:tipoEntrega IS NULL OR entrega."tipoEntrega" = :tipoEntrega)

    UNION ALL

    SELECT
      venta."ventaId",
      venta."fechaControlLocal",
      entrega.id AS "entregaId",
      entrega."createdAt" AS "fechaRegistroEntrega"
    FROM ventas_base venta
    INNER JOIN entregas entrega ON entrega."ventaId" IS NULL
    INNER JOIN clientes cliente_entrega ON cliente_entrega.id = entrega."clienteId"
    WHERE COALESCE(entrega.activo, TRUE) IS TRUE
      AND LENGTH(venta."cedulaNormalizada") IN (10, 13)
      AND cliente_entrega.cedula_normalizada = venta."cedulaNormalizada"
      AND (:estadoEntrega IS NULL OR entrega.estado = :estadoEntrega)
      AND (:tipoEntrega IS NULL OR entrega."tipoEntrega" = :tipoEntrega)
  ),
  entregas_por_mes AS (
    SELECT
      TO_CHAR(
        relacion."fechaRegistroEntrega" AT TIME ZONE 'America/Guayaquil',
        'YYYY-MM'
      ) AS mes,
      COUNT(DISTINCT relacion."entregaId")::INTEGER AS cantidad
    FROM relaciones_dashboard relacion
    WHERE relacion."fechaRegistroEntrega" IS NOT NULL
      AND (
        :fechaInicio IS NULL
        OR relacion."fechaRegistroEntrega" >=
          (CAST(:fechaInicio AS DATE)::TIMESTAMP AT TIME ZONE 'America/Guayaquil')
      )
      AND (
        :fechaFin IS NULL
        OR relacion."fechaRegistroEntrega" <
          ((CAST(:fechaFin AS DATE) + 1)::TIMESTAMP AT TIME ZONE 'America/Guayaquil')
      )
    GROUP BY mes
  ),
  ventas_desde_hora_por_mes AS (
    SELECT
      TO_CHAR(
        relacion."fechaControlLocal",
        'YYYY-MM'
      ) AS mes,
      COUNT(DISTINCT relacion."ventaId")::INTEGER AS cantidad
    FROM relaciones_dashboard relacion
    WHERE relacion."fechaControlLocal" IS NOT NULL
      AND (
        :fechaInicio IS NULL
        OR relacion."fechaControlLocal" >= CAST(:fechaInicio AS DATE)
      )
      AND (
        :fechaFin IS NULL
        OR relacion."fechaControlLocal" < CAST(:fechaFin AS DATE) + INTERVAL '1 day'
      )
      AND (
        :horaRegistroDesde IS NULL
        OR relacion."fechaControlLocal"::TIME >= CAST(:horaRegistroDesde AS TIME)
      )
    GROUP BY mes
  )
  SELECT 'ENTREGAS'::TEXT AS tipo, mes, cantidad
  FROM entregas_por_mes
  UNION ALL
  SELECT 'VENTAS_DESDE_HORA'::TEXT AS tipo, mes, cantidad
  FROM ventas_desde_hora_por_mes
  ORDER BY mes ASC, tipo ASC
`;

const ordenarEntregasDesc = (a, b) => {
  const fechaA = String(a.fechaRegistroEntrega || a.fechaEntrega || "");
  const fechaB = String(b.fechaRegistroEntrega || b.fechaEntrega || "");
  if (fechaA !== fechaB) return fechaB.localeCompare(fechaA);
  return Number(b.entregaId || 0) - Number(a.entregaId || 0);
};

const consolidarFilasInforme = (registros = []) => {
  const ventas = new Map();

  registros.forEach((registro) => {
    const clave = String(registro.ventaId);
    let acumulado = ventas.get(clave);

    if (!acumulado) {
      acumulado = {
        base: registro,
        entregas: new Map(),
        cantidadVentasCedula: Number(registro.cantidadVentasCedula || 0),
      };
      ventas.set(clave, acumulado);
    }

    acumulado.cantidadVentasCedula = Math.max(
      acumulado.cantidadVentasCedula,
      Number(registro.cantidadVentasCedula || 0),
    );
    acumulado.entregas.set(String(registro.entregaId), {
      entregaId: registro.entregaId,
      fechaEntrega: registro.fechaEntrega,
      fechaRegistroEntrega: registro.fechaRegistroEntrega,
      estadoEntrega: registro.estadoEntrega,
      tipoEntrega: registro.tipoEntrega,
      tipoRelacion: registro.tipoRelacion,
    });
  });

  return [...ventas.values()].map((acumulado) => {
    const entregas = [...acumulado.entregas.values()];
    const directas = entregas
      .filter((entrega) => entrega.tipoRelacion === "DIRECTA")
      .sort(ordenarEntregasDesc);
    const porCedula = entregas
      .filter((entrega) => entrega.tipoRelacion === "POR_CEDULA")
      .sort(ordenarEntregasDesc);
    const tieneDirecta = directas.length > 0;
    const entregaRepresentativa = (tieneDirecta ? directas : porCedula)[0];
    const relacionAmbigua =
      !tieneDirecta &&
      (porCedula.length > 1 || acumulado.cantidadVentasCedula > 1);
    const {
      cedulaNormalizada,
      cantidadVentasCedula,
      tipoRelacionConsolidada,
      relacionAmbiguaConsolidada,
      _total,
      _totalDirectas,
      _totalPorCedula,
      _totalAmbiguas,
      ...base
    } = acumulado.base;

    return {
      ...base,
      entregaId: entregaRepresentativa?.entregaId ?? null,
      fechaEntrega: entregaRepresentativa?.fechaEntrega ?? null,
      fechaRegistroEntrega:
        entregaRepresentativa?.fechaRegistroEntrega ?? null,
      estadoEntrega: entregaRepresentativa?.estadoEntrega ?? null,
      tipoEntrega: entregaRepresentativa?.tipoEntrega ?? null,
      tipoRelacion: tieneDirecta ? "DIRECTA" : "POR_CEDULA",
      cantidadEntregas: entregas.length,
      relacionAmbigua,
    };
  });
};

const idFiltro = (valor) => {
  if (valor == null || valor === "" || valor === "todos" || valor === "todas") {
    return null;
  }
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const idsFiltro = (valor) => {
  const valores = Array.isArray(valor)
    ? valor
    : String(valor ?? "").split(",");
  const ids = [
    ...new Set(
      valores
        .map((item) => Number(String(item).trim()))
        .filter((item) => Number.isInteger(item) && item > 0),
    ),
  ];

  return ids.length ? ids.join(",") : null;
};

const fechaFiltro = (valor) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "")) ? valor : null;

const horaFiltro = (valor) => {
  const hora = String(valor || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(hora)
    ? hora
    : null;
};

const tipoEntregaFiltro = (valor) => {
  const tipo = String(valor || "").trim().toLowerCase();
  if (tipo === "entrega") return "Entrega";
  if (tipo === "envio" || tipo === "envío") return "Envio";
  return null;
};

const booleanoFiltro = (valor) =>
  valor === true || ["true", "1", "si", "sí"].includes(
    String(valor || "").trim().toLowerCase(),
  );

const construirFiltrosSql = (filtros = {}) => {
  const replacements = {
    fechaInicio: fechaFiltro(filtros.fechaInicio),
    fechaFin: fechaFiltro(filtros.fechaFin),
    horaRegistroDesde: horaFiltro(filtros.horaRegistroDesde),
    agenciaIds: idsFiltro(filtros.agenciaIds ?? filtros.agenciaId),
    vendedorIds: idsFiltro(filtros.vendedorIds ?? filtros.vendedorId),
    origenId: idFiltro(filtros.origenId),
    soloOrigenEntrega: booleanoFiltro(filtros.soloOrigenEntrega),
    estadoEntrega: String(filtros.estadoEntrega || "").trim() || null,
    tipoEntrega: tipoEntregaFiltro(filtros.tipoEntrega),
  };

  if (
    replacements.fechaInicio &&
    replacements.fechaFin &&
    replacements.fechaInicio > replacements.fechaFin
  ) {
    const error = new Error("La fecha inicial no puede ser mayor que la fecha final.");
    error.status = 400;
    throw error;
  }

  return replacements;
};

const paginaFiltro = (valor) => {
  const pagina = Number(valor);
  return Number.isInteger(pagina) && pagina > 0 ? pagina : 1;
};

const limiteFiltro = (valor) => {
  const limite = Number(valor);
  return Number.isInteger(limite) && limite > 0
    ? Math.min(limite, 100)
    : 25;
};

const consultarInformeVentasConEntrega = async (
  filtros = {},
  { paginar = true } = {},
) => {
  const page = paginaFiltro(filtros.page);
  const limit = limiteFiltro(filtros.limit);
  const replacements = {
    ...construirFiltrosSql(filtros),
    busqueda: String(filtros.busqueda || "").trim() || null,
    limite: paginar ? limit : null,
    offset: paginar ? (page - 1) * limit : 0,
  };

  const registros = await sequelize.query(SQL_INFORME_VENTAS_CON_ENTREGA, {
    replacements,
    type: QueryTypes.SELECT,
  });

  let metadatos = registros[0] || {};
  if (paginar && page > 1 && registros.length === 0) {
    const [filaMetadatos] = await sequelize.query(
      SQL_INFORME_VENTAS_CON_ENTREGA,
      {
        replacements: { ...replacements, limite: 1, offset: 0 },
        type: QueryTypes.SELECT,
      },
    );
    metadatos = filaMetadatos || {};
  }
  const ventas = consolidarFilasInforme(registros);
  const total = Number(metadatos._total ?? ventas.length);

  return {
    ventas,
    page: paginar ? page : 1,
    limit: paginar ? limit : total,
    total,
    totalPages: paginar ? Math.max(1, Math.ceil(total / limit)) : 1,
    resumen: {
      directas: Number(metadatos._totalDirectas || 0),
      porCedula: Number(metadatos._totalPorCedula || 0),
      ambiguas: Number(metadatos._totalAmbiguas || 0),
    },
  };
};

const obtenerInformeVentasConEntrega = async (filtros = {}) =>
  (await consultarInformeVentasConEntrega(filtros, { paginar: false })).ventas;

const obtenerPaginaInformeVentasConEntrega = (filtros = {}) =>
  consultarInformeVentasConEntrega(filtros, { paginar: true });

const obtenerDashboardVentasConEntrega = async (filtros = {}) => {
  const replacements = construirFiltrosSql(filtros);

  const registros = await sequelize.query(SQL_DASHBOARD_VENTAS_CON_ENTREGA, {
    replacements,
    type: QueryTypes.SELECT,
  });

  return {
    entregasPorMes: registros
      .filter((registro) => registro.tipo === "ENTREGAS")
      .map((registro) => ({
        mes: registro.mes,
        cantidad: Number(registro.cantidad || 0),
      })),
    ventasDesdeHoraPorMes: registros
      .filter((registro) => registro.tipo === "VENTAS_DESDE_HORA")
      .map((registro) => ({
        mes: registro.mes,
        cantidad: Number(registro.cantidad || 0),
      })),
  };
};

module.exports = {
  SQL_DASHBOARD_VENTAS_CON_ENTREGA,
  SQL_INFORME_VENTAS_CON_ENTREGA,
  buscarVentasActivasPorCedula,
  consolidarFilasInforme,
  normalizarCedula,
  obtenerDashboardVentasConEntrega,
  obtenerInformeVentasConEntrega,
  obtenerPaginaInformeVentasConEntrega,
  resolverVentaParaEntrega,
  seleccionarVentaInequivoca,
};
