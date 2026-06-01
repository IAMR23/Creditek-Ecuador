const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connectDB } = require("./config/db");
require("./models/associations");

const usuarioRoutes = require("./routes/UsuarioRoutes");
const agenciaRoutes = require("./routes/AgenciaRoutes");
const usuarioAgenciaRoutes = require("./routes/UsuarioAgenciaRoutes");
const rolRoutes = require("./routes/RolRoutes");
const authRoutes = require("./routes/authRoutes");
const bootstrapRoutes = require("./routes/bootstrapRoutes");
const asistenciaRoutes = require("./routes/AsistenciaRoutes");
const auth = require("./middleware/auth");
const Rol = require("./models/Rol");
const Agencia = require("./models/Agencia");

const app = express();
const PORT = process.env.PORT || 5030;

const allowedOrigins = [
  process.env.WEB_CORS,
  /^https?:\/\/localhost:\d+$/,
];

app.use(
  cors({
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
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, app: "APOLO BUSINESS SOLUTIONS" }));
app.use("/bootstrap", bootstrapRoutes);
app.use("/auth", authRoutes);

app.use("/usuarios",  auth, usuarioRoutes);
app.use("/agencias",  auth , agenciaRoutes);
app.use("/usuario-agencia",  auth , usuarioAgenciaRoutes);
app.use("/rol", auth,  rolRoutes);
app.use("/asistencias", auth, asistenciaRoutes);

connectDB()
  .then(() => {
    Promise.all([
      Rol.count().then(async (count) => {
        if (count === 0) {
          await Rol.bulkCreate([
            { nombre: "ADMIN", descripcion: "Administrador", activo: true },
            { nombre: "USUARIO", descripcion: "Usuario", activo: true },
          ]);
        }
      }),
      Agencia.count().then(async (count) => {
        if (count === 0) {
          await Agencia.create({ nombre: "Matriz", activo: true });
        }
      }),
    ]).catch((e) => console.error("Seed inicial falló:", e.message));

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`APOLO backend corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar a la base de datos:", err);
    process.exit(1);
  });
