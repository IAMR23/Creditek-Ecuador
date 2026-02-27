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
      allowNull: true,
    },

    cedulaGestionado: {
      type: DataTypes.STRING,
      allowNull: true,
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
      type: DataTypes.ENUM("NINGUNA", "APROBADO", "DENEGADO"),
      allowNull: false,
    },

/*     origen: {
      type: DataTypes.ENUM(
        "REFERIDO",
        "REGESTION",
        "WHATSAPP", 
        "WHATSAPP ANUNCIOS",
        "MESSENGER",
        "DIFUSIONES",
        "BASE_DE_DATOS",
        "PAUTA",
        "TIKTOK"
      ),
      allowNull: true,
    }, */
/*     origenCallCenter : {
      type: DataTypes.STRING,
      allowNull: true,
    } ,  */

    origen : {
      type: DataTypes.TEXT,
      allowNull: true,
    }, 
    region: {
      type: DataTypes.ENUM(
        "SIN_ESPECIFICAR",
        "COSTA",
        "COSTA_APLICA",
        "COSTA_NO_APLICA",
        "SIERRA",
        "ORIENTE",
        "ORIENTE_APLICA",
        "ORIENTE_NO_APLICA",
        
      ),
      allowNull: false,
    },

    accion: {
      type: DataTypes.ENUM(
        "VENTA",
        "ENTREGA",
        "VOLVER_A_LLAMAR",
        "GESTION",
        "NO_CONTESTA",
        "OTRA_CEDULA",
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
  },
);

module.exports = Gestion;
