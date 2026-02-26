const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
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

const path = require("path");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5020;

// Permitir localhost y dominio de producción
const allowedOrigins = [
  "http://192.168.1.123:5173",
  /^https?:\/\/localhost:\d+$/, // cualquier puerto en localhost
  /^https?:\/\/(www\.)?creditek-ecuador\.com$/, // producción
  /^https?:\/\/(www\.)?rve.creditek-ecuador\.com$/, // producción
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // Postman, curl, etc.
      const allowed = allowedOrigins.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin)
      );
      if (allowed) return callback(null, true);
      return callback(new Error("CORS no permitido: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Manejar preflight
app.options("*", cors());

// --- Middleware ---
app.use(express.json());

// --- Conexión DB y rutas ---
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
    app.use("/api/postulaciones", postulacionesRouter  )
    app.use("/api/permisos-catalogo", require("./routes/permisoRoutes"));
    app.use("/api/usuario-agencia-permisos", require("./routes/usuarioAgenciaPermisoRoutes"));
    app.use("/api/traslados", require("./routes/trasladosRoutes"));
    app.use("/api/gestion", require("./routes/CallCenter/gestionRoutes"));
    app.use("/api/contabilidad", require("./routes/Contabilidad/CajaRoutes"));
    app.use("/api/movimientos", require("./routes/Contabilidad/MovimientoRoutes"));
    app.use("/api/gerencia", require("./routes/Gerencia/informesRoutes"));


    console.log(
      "Carpeta uploads que Express está usando:",
      path.join(__dirname, "uploads")
    );

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar a la base de datos:", err);
    process.exit(1);
  });
