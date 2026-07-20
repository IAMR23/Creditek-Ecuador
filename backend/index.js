const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { JWT_SECRET } = require("./utils/tokenConfig");
const { connectDB } = require("./config/db");
require("./models/associations");
  
// Rutas
const authRoutes = require("./routes/authRoutes");
const agencia = require("./routes/AgenciaRoutes");
const usuario_agencia = require("./routes/UsuarioAgenciaRoutes");
const usuario = require("./routes/UsuarioRoutes");
const cliente = require("./routes/clienteRoutes");
const rol = require("./routes/rolRoutes");
const dispositivos = require("./routes/DispositivoRoutes");
const marcas = require("./routes/MarcaRoutes");
const modelos = require("./routes/ModeloRoutes");
const dispositivoMarca = require("./routes/dispositivoMarcaRoutes");
const CostoHistoricoRoutes = require("./routes/costoHistoricoRoutes");
const FormaPago = require("./routes/formaPagoRoutes");
const OrigenRoutes = require("./routes/origenRoutes");
const VentaRoutes = require("./routes/ventasroutes");
const DetalleVentaRoutes = require("./routes/detalleVentaRoutes");
const precioDispositivoRoutes = require("./routes/precio");
const postulacionesRouter = require("./routes/DesarrolloOrganizacional/postulacionesRouter");
const { startTaskCron } = require("./services/taskCron");
const path = require("path");
const startTaskReminderJob = require("./jobs/taskReminder");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5020;

const parseCookies = (req, _res, next) => {
  const header = req.headers.cookie || "";
  req.cookies = header.split(";").reduce((cookies, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return cookies;

    cookies[rawKey] = decodeURIComponent(rawValue.join("=") || "");
    return cookies;
  }, {});
  next();
};

/* startTaskCron();
startTaskReminderJob();
 */

// Permitir localhost y dominio de producción
const allowedOrigins = [
  process.env.WEB_CORS,
  "http://192.168.1.123:5173",
  /^https?:\/\/localhost:\d+$/,
  /^https?:\/\/127\.0\.0\.1:\d+$/,
  /^https?:\/\/(www\.)?creditek-ecuador\.com(:\d+)?$/,
  /^https?:\/\/(www\.)?rve\.creditek-ecuador\.com(:\d+)?$/,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === "string" ? o === origin : o.test(origin)
    );
    if (allowed) return callback(null, true);
    return callback(new Error("CORS no permitido: " + origin), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition", "X-RVE-Registros", "X-RVE-No-Leidas"],
  maxAge: 3600,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// Middleware
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(parseCookies);

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );

      if (allowed) return callback(null, true);
      return callback(new Error("Socket CORS no permitido: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// Guardar instancia para usarla en controladores
app.set("io", io);

// Middleware de autenticación para sockets
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No autorizado: token no enviado"));
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = {
      id: decoded.usuario?.id,
      email: decoded.usuario?.email,
      rol: decoded.usuario?.rol?.nombre,
    };
  
    next();
  } catch (error) {
    console.error("Error autenticando socket:", error.message);
    next(new Error("Token inválido"));
  }
});

// Conexión de sockets
io.on("connection", (socket) => {
  const userId = socket.user.id;

  // Room individual por usuario
  socket.join(`user_${userId}`);


  socket.on("disconnect", () => {
  });
});

/* =========================
   DB + RUTAS
========================= */
connectDB()
  .then(() => {
    console.log("Base de datos conectada");

    app.use("/agencias", agencia);
    app.use("/dashboard", require("./routes/Admin/dashboardRoutes"));
    app.use("/auth", authRoutes);
    app.use("/usuario-agencia", usuario_agencia);
    app.use("/usuarios", usuario);
    app.use("/clientes", cliente);
    app.use("/rol", rol);
    app.use("/dispositivos", dispositivos);
    app.use("/marcas", marcas);
    app.use("/modelos", modelos);
    app.use("/dispositivoMarca", dispositivoMarca);
    app.use("/costos", CostoHistoricoRoutes); 
    app.use("/formaPago", FormaPago);   
    app.use("/origen", OrigenRoutes);   
    app.use("/ventas", VentaRoutes); 
    app.use("/detalle-venta", DetalleVentaRoutes); 
    app.use("/precio", precioDispositivoRoutes);
    app.use("/obsequios", require("./routes/obsequioRoutes"));
    app.use("/venta-obsequios", require("./routes/ventaObsequioRoutes"));
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
    app.use("/admin/metas-comerciales", require("./routes/Admin/adminRoutes"));
    app.use("/admin/ventastotales", require("./routes/Admin/ventastotales"));
    app.use("/vendedor", require("./routes/Vendedor/VendedorRoute"));
    app.use("/entregas", require("./routes/entregaRoutes"));
    app.use("/detalle-entrega", require("./routes/detalleEntregaRoutes"));
    app.use("/entrega-obsequios", require("./routes/entregaObsequioRoutes"));
    app.use("/estado-entrega", require("./routes/estadoEntregaRoutes"));
    app.use("/alertas", require("./routes/entregasAlertasRouter"));
    app.use("/auditoria", require("./routes/Auditoria/auditoriaRoutes"));
    app.use("/registrar", require("./routes/Vendedor/crearVentaCompletaRoute"));
    app.use("/registrar2", require("./routes/Vendedor/crearEntregaCompletaRoute"));
    app.use("/api/postulaciones", postulacionesRouter);
    app.use("/api/permisos-catalogo", require("./routes/permisoRoutes"));
    app.use("/api/usuario-permisos", require("./routes/usuarioPermisoRoutes"));
    app.use("/api/traslados", require("./routes/trasladosRoutes"));
    app.use("/api/gestion", require("./routes/CallCenter/gestionRoutes"));
    app.use("/api/gestion-comercial", require("./routes/Comercial/gestionRoutes"));
    app.use("/api/contabilidad", require("./routes/Contabilidad/CajaRoutes"));
    app.use("/api/contabilidad/reportes-caja", require("./routes/Contabilidad/reportesCajaRoutes"));
    app.use("/api/contabilidad/nomina", require("./routes/Contabilidad/nominaRoutes"));
    app.use("/api/contabilidad/roles-pago", require("./routes/Contabilidad/rolesPagoRoutes"));
    app.use("/api/contabilidad/comisiones", require("./routes/Contabilidad/comisionesConfiguracionRoutes"));
    app.use("/api/contabilidad/sanciones-configuracion", require("./routes/Contabilidad/sancionesConfiguracionRoutes"));
    app.use("/api/contabilidad/sanciones-ventas", require("./routes/Contabilidad/sancionesVentasRoutes"));
    app.use("/api/contabilidad/pagos-comisiones", require("./routes/Contabilidad/pagosComisionesRoutes"));
    app.use("/api/gerencia", require("./routes/Gerencia/informesRoutes"));
    app.use("/api/gerencia", require("./routes/Gerencia/costoVentaMarketingRoutes"));
    app.use("/api/gerencia/secretarios-ejecutivos/planes", require("./routes/Gerencia/secretariosEjecutivosPlanesRoutes"));
    app.use("/api/conciliacion", require("./routes/conciliacionRoutes"));
    app.use("/api/tareas", require("./routes/Sistemas/tareasRoutes"));
    app.use("/api/sistemas/mapa-comercial", require("./routes/Sistemas/mapaComercialRoutes"));
    app.use("/api/sistemas/inventarios", require("./routes/Sistemas/inventariosRoutes"));
    app.use("/api/alertas-personal", require("./routes/alertasPersonalRoutes"));
    app.use("/api/planes-batalla", require("./routes/planesBatallaRoutes"));
    app.use("/tasks", require("./routes/taskRoutes"));
    app.use("/api/movimientos", require("./routes/Contabilidad/movimientosTemp"));
    app.use("/api/ghl/dashboard", require("./routes/GHL/dashboardRoutes"));
    app.use("/api/webhooks", require("./routes/webhookRoutes"));
    app.use("/api/meta", require("./routes/metaRoutes"));
    app.use("/api/facebook", require("./routes/facebookWebhookRoutes"));
    console.log(
      "Carpeta uploads que Express está usando:", 
    );
 
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar a la base de datos:", err);
    process.exit(1);
  }); 
  
