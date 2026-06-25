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
const { calcularEstadisticasVentas, comiteCompras } = require("../../utils/calcularEstadisticasVentas");

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

router.get("/ventas", async (req, res) => {
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
    res.json({ ok: true, ventas: reporte , totalVentas : ventas.length});
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post(
  "/ventas/importar-pdf",
  prepareUploadFolder,
  uploadPdfs,
  auditoriaVentasController.auditarVentasDesdePdf,
);

router.patch(
  "/ventas/detalle/:detalleVentaId",
  auditoriaVentasController.actualizarDetalleVentaAuditoria,
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




module.exports = router;
