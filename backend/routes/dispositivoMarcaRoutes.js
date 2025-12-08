// routes/dispositivoMarcaRoutes.js
const express = require("express");
const router = express.Router();
const dispositivoMarcaController = require("../controllers/dispositivoMarcaController");
const Modelo = require("../models/Modelo");
// Crear relación dispositivo-marca
router.post("/", dispositivoMarcaController.crearDispositivoMarca);

// Listar todas las relaciones
router.get("/", dispositivoMarcaController.listarDispositivoMarca);

router.get("/:dispositivoMarcaId", async (req, res) => {
  try {
    const id = parseInt(req.params.dispositivoMarcaId, 10);
    if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

    const modelos = await Modelo.findAll({
      where: { dispositivoMarcaId: id },
    });

    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener modelos" });
  }
});

// Obtener relación por ID
/* router.get("/:id", dispositivoMarcaController.obtenerDispositivoMarca);
 */

// Actualizar relación (solo activo)
router.put("/:id", dispositivoMarcaController.actualizarDispositivoMarca);

// Eliminar relación
router.delete("/:id", dispositivoMarcaController.eliminarDispositivoMarca);

module.exports = router;
