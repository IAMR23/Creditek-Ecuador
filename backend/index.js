const express = require("express");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const {connectDB} = require("./config/db");

const authRoutes  = require("./routes/authRoutes")
const agencia  = require("./routes/AgenciaRoutes")
const usuario_agencia  = require("./routes/UsuarioAgenciaRoutes")
const usuario  = require("./routes/UsuarioRoutes")
const venta  = require("./routes/VentaRoutes")
const cliente  = require("./routes/clienteRoutes")
const producto  = require("./routes/productoRoutes")
const entrega  = require("./routes/entregaRoutes")
const dashbaord  = require("./routes/dashboardRoutes")
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5020;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS no permitido: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("*", cors());
app.use(express.json());


connectDB()
  .then(() => {
    console.log("Base de datos conectada");
    app.use ("/agencias" , agencia)
    app.use ("/auth" , authRoutes)  
    app.use ("/usuario-agencia" , usuario_agencia)
    app.use ("/usuarios" , usuario)
    app.use ("/venta" , venta)
    app.use ("/clientes" , cliente)
    app.use ("/productos" , producto)
    app.use ("/entregas" , entrega)
    app.use ("/dashboard" , dashbaord)
    

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    })
  })
  .catch((err) => {
    console.error("Error al conectar a la base de datos:", err);
    process.exit(1);
  });
