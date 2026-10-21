const broadcastService = require("../../services/ghlBroadcastService");
const messageService = require("../../services/ghlBroadcastMessageService");
const categoryService = require("../../services/ghlBroadcastCategoryService");
const mediaService = require("../../services/ghlBroadcastMediaService");
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

async function pipelines(_req, res) {
  try {
    return res.json({ ok: true, pipelines: await broadcastService.listPipelines() });
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
    const executions = await queueService.getActiveExecutions();
    return res.json({
      ok: true,
      execution: executions[0] || null,
      executions,
    });
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

async function executions(req, res) {
  try {
    return res.json({ ok: true, ...await queueService.listExecutions(req.query || {}) });
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

async function savedMessages(_req, res) {
  try {
    return res.json({ ok: true, mensajes: await messageService.listSavedMessages() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function createSavedMessage(req, res) {
  try {
    const mensaje = await messageService.createSavedMessage(req.body || {}, req.user.id);
    return res.status(201).json({ ok: true, mensaje });
  } catch (error) {
    return respondError(res, error);
  }
}

async function updateSavedMessage(req, res) {
  try {
    const mensaje = await messageService.updateSavedMessage(req.params.id, req.body || {}, req.user.id);
    return res.json({ ok: true, mensaje });
  } catch (error) {
    return respondError(res, error);
  }
}

async function deleteSavedMessage(req, res) {
  try {
    const deleted = await messageService.deleteSavedMessage(req.params.id);
    return res.json({ ok: true, deleted });
  } catch (error) {
    return respondError(res, error);
  }
}

async function categories(_req, res) {
  try {
    return res.json({ ok: true, categorias: await categoryService.listCategories() });
  } catch (error) {
    return respondError(res, error);
  }
}

async function createCategory(req, res) {
  try {
    const categoria = await categoryService.createCategory(req.body || {}, req.user.id);
    return res.status(201).json({ ok: true, categoria });
  } catch (error) {
    return respondError(res, error);
  }
}

async function updateCategory(req, res) {
  try {
    const categoria = await categoryService.updateCategory(req.params.id, req.body || {}, req.user.id);
    return res.json({ ok: true, categoria });
  } catch (error) {
    return respondError(res, error);
  }
}

async function deleteCategory(req, res) {
  try {
    return res.json({ ok: true, deleted: await categoryService.deleteCategory(req.params.id) });
  } catch (error) {
    return respondError(res, error);
  }
}

async function uploadImage(req, res) {
  try {
    const forwardedProtocol = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
    const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
    const protocol = forwardedProtocol || req.protocol;
    const host = forwardedHost || req.get("host");
    const proxyOrigin = `${protocol}://${host}`;
    const browserOrigin = String(req.get("origin") || "").trim();
    const requestOrigin = /^https:\/\//i.test(proxyOrigin) ? proxyOrigin : browserOrigin || proxyOrigin;
    const imagen = await mediaService.saveBroadcastImage(req.file);
    imagen.url = mediaService.publicImageUrl(imagen.url, requestOrigin);
    return res.status(201).json({ ok: true, imagen });
  } catch (error) {
    return respondError(res, error);
  }
}

module.exports = {
  contacts,
  activeExecution,
  cancelExecution,
  categories,
  createCategory,
  createSavedMessage,
  createSmartList,
  deleteSmartList,
  deleteSavedMessage,
  deleteCategory,
  execution,
  executions,
  pipelines,
  preview,
  savedMessages,
  send,
  smartListContacts,
  smartLists,
  status,
  tags,
  updateCategory,
  updateSavedMessage,
  updateSmartList,
  uploadImage,
};
