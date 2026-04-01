const express = require("express");
const router = express.Router();
const controller = require('../controllers/task');
const { authenticate } = require("../middleware/authMiddleware");

router.post("/", authenticate,  controller.createTask);
router.get("/", authenticate ,  controller.getTasks);
router.get("/me", authenticate ,  controller.getMyTasks);

router.get("/:id",authenticate,  controller.getTaskById);
router.put("/:id", authenticate, controller.updateTask);
router.delete("/:id", authenticate, controller.deleteTask);

router.put("/:id/complete", authenticate, controller.completeTask);

router.get("/reminders/all", authenticate  , controller.getTasksWithReminder);

module.exports = router;