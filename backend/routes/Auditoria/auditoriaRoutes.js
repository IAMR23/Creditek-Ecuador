const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const multer = require("multer");
const router = express.Router();
const auditoriaVentasController = require("../../controllers/Auditoria/auditoriaVentasController");
const tareasSistemasController = require("../../controllers/Sistemas/tareasController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const {
  calcularEstadisticasVentas,
  calcularResumenMargen,
  comiteCompras,
} = require("../../utils/calcularEstadisticasVentas");

const accesoAuditoria = [authenticate, requirePermission("Auditoria", "Administracion")];

const uploadRoot =
  process.env.AUDITORIA_TEMP_DIR ||
  path.join(os.tmpdir(), "rve-auditoria-pdf");

const prepareUploadFolder = (req, res, next) => {
  const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  req.auditoriaTempRoot = path.join(uploadRoot, id);
  req.auditoriaInputDir = path.join(req.auditoriaTempRoot, "pdfs");

  fs.mkdirSync(req.auditoriaInputDir, { recursive: true });
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.auditoriaInputDir);
  },
  filename: (req, file, cb) => {
    const original = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${original}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 30,
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPdf) {
      return cb(new Error("Solo se permiten archivos PDF"));
    }

    cb(null, true);
  },
});

const uploadPdfs = (req, res, next) => {
  upload.array("pdfs", 30)(req, res, async (error) => {
    if (!error) return next();

    if (req.auditoriaTempRoot) {
      await fsp.rm(req.auditoriaTempRoot, { recursive: true, force: true }).catch(
        () => {},
      );
    }

    return res.status(400).json({
      ok: false,
      message: error.message || "No se pudieron subir los PDFs",
    });
  });
};

router.get("/ventas", accesoAuditoria, async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      origenId,
      dispositivoId,
      estado,
    } = req.query;

    const ventas = await auditoriaVentasController.obtenerReporteAuditoria({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      origenId,
      dispositivoId,
      estado,
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);
    await auditoriaVentasController.notificarDiferenciasPrecioAuditoria(req, reporte);
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post(
  "/ventas/importar-pdf",
  accesoAuditoria,
  prepareUploadFolder,
  uploadPdfs,
  auditoriaVentasController.auditarVentasDesdePdf,
);

router.patch(
  "/ventas/detalle/:detalleVentaId",
  auditoriaVentasController.actualizarDetalleVentaAuditoria,
);

router.get("/entregas", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      dispositivoId,
      estado,
    } = req.query;

    const entregas = await auditoriaVentasController.obtenerReporteEntregasAuditoria({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      modeloId,
      cierreCaja,
      dispositivoId,
      estado,
    });

    res.json({ ok: true, entregas, totalEntregas: entregas.length });
  } catch (error) {
    console.error("Error reporte entregas auditoria:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.patch(
  "/entregas/:id/desactivar",
  accesoAuditoria,
  auditoriaVentasController.desactivarEntregaAuditoria,
);

router.patch(
  "/entregas/:id/activar",
  accesoAuditoria,
  auditoriaVentasController.activarEntregaAuditoria,
);

router.get("/informe", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId, vendedorId   , observacion} = req.query;

    const ventas = await auditoriaVentasController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      observacion   , 
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

  
router.get("/ventas2", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      cierreCaja,
      observacion,
    } = req.query;

    const ventas = await auditoriaVentasController.obtenerReporteGerencia({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      cierreCaja,
      observacion,
    });

    const reporte = auditoriaVentasController.formatearReporte(ventas);

    const estadisticas = calcularEstadisticasVentas(reporte , fechaInicio);
    estadisticas.debugMargen = {
      ...estadisticas.debugMargen,
      rangoFechasAplicado: {
        fechaInicio,
        fechaFin,
      },
      filtrosAplicados: {
        agenciaId: agenciaId || null,
        vendedorId: vendedorId || null,
        cierreCaja: cierreCaja || null,
        observacion: observacion || null,
      },
    };
    estadisticas.tareasFinalizadasPorFecha =
      await tareasSistemasController.obtenerTareasFinalizadasPorFecha({
        fechaInicio,
        fechaFin,
      });
    estadisticas.tareasFinalizadasPorSemana =
      await tareasSistemasController.obtenerTareasFinalizadasPorSemana({
        fechaInicio,
        fechaFin,
      });
    estadisticas.totalTareasFinalizadas =
      estadisticas.tareasFinalizadasPorSemana.reduce(
        (acc, item) => acc + (Number(item.tareasFinalizadas) || 0),
        0,
      );
    estadisticas.entregasPorVendedor =
      await auditoriaVentasController.obtenerEntregasPorVendedorDashboard({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
      });
 
    res.json({ ok: true, estadisticas});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/ventas2/debug-margen", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      cierreCaja,
      observacion,
    } = req.query;

    const filtrosAplicados = {
      fechaInicio,
      fechaFin,
      agenciaId: agenciaId || null,
      vendedorId: vendedorId || null,
      cierreCaja: cierreCaja || null,
      observacion: observacion || null,
    };

    const ventasPowerBi = await auditoriaVentasController.obtenerReporteGerencia({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      cierreCaja,
      observacion,
    });
    const reportePowerBi = auditoriaVentasController.formatearReporte(ventasPowerBi);
    const resumenPowerBi = calcularResumenMargen(reportePowerBi, {
      fechaInicio,
      fechaFin,
    });

    const ventasMetas = await auditoriaVentasController.obtenerReporte({
      fechaInicio,
      fechaFin,
      agenciaId,
      vendedorId,
      observacion,
    });
    const reporteMetas = auditoriaVentasController.formatearReporte(ventasMetas);
    const resumenMetas = calcularResumenMargen(reporteMetas, {
      fechaInicio,
      fechaFin,
    });

    const powerBiDetalleIds = new Set(
      resumenPowerBi.registros
        .map((item) => item.detalleVentaId)
        .filter((id) => id !== null && id !== undefined),
    );
    const metasDetalleIds = new Set(
      resumenMetas.registros
        .map((item) => item.detalleVentaId)
        .filter((id) => id !== null && id !== undefined),
    );
    const soloPowerBi = resumenPowerBi.registros.filter(
      (item) => item.detalleVentaId && !metasDetalleIds.has(item.detalleVentaId),
    );
    const soloMetasComerciales = resumenMetas.registros.filter(
      (item) => item.detalleVentaId && !powerBiDetalleIds.has(item.detalleVentaId),
    );

    const debug = {
      formula: "MargenPorcentaje = totalMargen / totalCosto * 100",
      filtrosAplicados,
      powerBi: resumenPowerBi,
      metasComerciales: resumenMetas,
      comparacionRegistros: {
        soloPowerBi,
        soloMetasComerciales,
      },
      diferencias: {
        totalMargen: Number(
          (resumenPowerBi.totalMargen - resumenMetas.totalMargen).toFixed(2),
        ),
        totalCosto: Number(
          (resumenPowerBi.totalCosto - resumenMetas.totalCosto).toFixed(2),
        ),
        margenPorcentaje: Number(
          (
            resumenPowerBi.margenPorcentaje - resumenMetas.margenPorcentaje
          ).toFixed(2),
        ),
        cantidadRegistros:
          resumenPowerBi.cantidadRegistros - resumenMetas.cantidadRegistros,
      },
    };

    console.log("[DEBUG margen Power BI]", JSON.stringify(debug, null, 2));

    res.json({ ok: true, debug });
  } catch (error) {
    console.error("Error debug margen Power BI:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});




module.exports = router;
