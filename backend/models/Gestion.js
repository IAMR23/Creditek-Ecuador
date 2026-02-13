const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Gestion = sequelize.define(
  "Gestion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    celularGestionado: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    cedulaGestionado: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    extension: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    dispositivoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }, 

    solicitud: {
      type: DataTypes.ENUM("APROBADO", "DENEGADO"),
      allowNull: false,
    },

    origen: {
      type: DataTypes.ENUM(
        "WHATSAPP",
        "MESSENGER",
        "DIFUSIONES",
        "BASE_DE_DATOS"
      ),
      allowNull: false,
    },

    region: {
      type: DataTypes.ENUM("COSTA", "SIERRA", "ORIENTE"),
      allowNull: false,
    },

    accion: {
      type: DataTypes.ENUM(
        "VENTA",
        "ENTREGA",
        "VOLVER_A_LLAMAR",
        "REGESTION",
        "NO_CONTESTA",
        "OTRA_CEDULA"
      ),
      allowNull: false,
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 🔥 Aquí se guardan múltiples cédulas cuando acción = OTRA_CEDULA
    otrasCedulas: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "gestiones",
  }
);

module.exports = Gestion;
