const broadcastService = require("../../services/ghlBroadcastService");
const smartListService = require("../../services/ghlSmartListService");
const queueService = require("../../services/ghlBroadcastQueueService");
const broadcastScheduler = require("../../services/ghlBroadcastScheduler");

const respondError = (res, error) => res.status(error.statusCode || 500).json({
  ok: false,
  code: error.code || "GHL_BROADCAST_ERROR",
  message: error.message || "No se pudo completar la operacion de difusion",
});

async function status(_req, res) {
  try {
    return res.json({ ok: true, messageHub: await broadcastService.getMessageHubStatus() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function contacts(req, res) {
  try {
    const result = await broadcastService.listContacts(req.query);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return respondError(res, error);
  }
}

async function tags(_req, res) {
  try {
    return res.json({ ok: true, tags: await broadcastService.listLocationTags() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function preview(req, res) {
  try {
    const result = await broadcastService.previewBroadcast(req.body || {});
    return res.json({ ok: true, preview: result });
  } catch (error) {
    return respondError(res, error);
  }
}

async function send(req, res) {
  try {
    const execution = await queueService.createExecution(req.body || {}, req.user.id);
    setImmediate(() => broadcastScheduler.tick().catch((error) => {
      console.error("Error iniciando lote de difusion GHL:", {
        code: error.code,
        message: error.message,
        executionId: execution.id,
      });
    }));
    return res.status(202).json({ ok: true, execution });
  } catch (error) {
    console.error("Error ejecutando difusion GHL:", {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      userId: req.user?.id,
    });
    return respondError(res, error);
  }
}

async function activeExecution(_req, res) {
  try {
    return res.json({ ok: true, execution: await queueService.getActiveExecution() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function execution(req, res) {
  try {
    return res.json({ ok: true, execution: await queueService.getExecution(req.params.id) });
  } catch (error) {
    return respondError(res, error);
  }
}

async function cancelExecution(req, res) {
  try {
    return res.json({ ok: true, execution: await queueService.cancelExecution(req.params.id) });
  } catch (error) {
    return respondError(res, error);
  }
}

async function smartLists(_req, res) {
  try {
    return res.json({ ok: true, listas: await smartListService.listSmartLists() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function createSmartList(req, res) {
  try {
    const lista = await smartListService.createSmartList(req.body || {}, req.user.id);
    return res.status(201).json({ ok: true, lista });
  } catch (error) {
    return respondError(res, error);
  }
}

async function updateSmartList(req, res) {
  try {
    const lista = await smartListService.updateSmartList(req.params.id, req.body || {}, req.user.id);
    return res.json({ ok: true, lista });
  } catch (error) {
    return respondError(res, error);
  }
}

async function deleteSmartList(req, res) {
  try {
    const deleted = await smartListService.deleteSmartList(req.params.id);
    return res.json({ ok: true, deleted });
  } catch (error) {
    return respondError(res, error);
  }
}

async function smartListContacts(req, res) {
  try {
    const result = await smartListService.listSmartListContacts(req.params.id, req.query);
    return res.json({ ok: true, ...result });
  } catch (error) {
    return respondError(res, error);
  }
}

module.exports = {
  contacts,
  activeExecution,
  cancelExecution,
  createSmartList,
  deleteSmartList,
  execution,
  preview,
  send,
  smartListContacts,
  smartLists,
  status,
  tags,
  updateSmartList,
};
