const express = require("express");
const { createTask, filterTasks, updateTaskStatus, getMyTasks } = require("../controllers/task");
const router = express.Router();

router.post("/", createTask);
router.get("/my",  getMyTasks);
router.get("/", filterTasks);
router.put("/:id/status", updateTaskStatus);

module.exports = router;  