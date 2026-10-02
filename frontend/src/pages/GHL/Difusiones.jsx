import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  History,
  ListFilter,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  SlidersHorizontal,
  Smartphone,
  Timer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import api from "../../api/client";
import { useAuthUser } from "../../utils/useAuthUser";

const PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
const FILTER_FIELDS = [
  { value: "tags", label: "Etiqueta" },
  { value: "source", label: "Origen" },
  { value: "query", label: "Nombre, telefono o correo" },
  { value: "firstName", label: "Nombre" },
  { value: "lastName", label: "Apellido" },
  { value: "email", label: "Correo electronico" },
  { value: "phone", label: "Telefono" },
  { value: "pipelineStageId", label: "Etapa del pipeline" },
];
const FILTER_OPERATORS = [
  { value: "eq", label: "Es" },
  { value: "not_eq", label: "No es" },
  { value: "contains", label: "Contiene" },
  { value: "not_contains", label: "No contiene" },
];
const EXECUTION_STATUS = {
  pending: "Pendiente",
  running: "En curso",
  completed: "Completada",
  partial: "Completada con novedades",
  cancelled: "Cancelada",
};
const DETAIL_STATUS = {
  pending: "Pendiente",
  processing: "Procesando",
  sent: "Enviado",
  failed: "Fallido",
  cancelled: "Cancelado",
};
let filterRuleSequence = 0;
let messageVariantSequence = 0;

const errorMessage = (error) =>
  error.response?.data?.message || error.message || "No se pudo completar la operacion";

const initialInstances = () => [1, 2, 3, 4, 5].map((index) => ({ index, selected: false }));
const newFilterRule = (values = {}) => ({
  key: `filter-rule-${filterRuleSequence += 1}`,
  field: "tags",
  operator: "eq",
  value: "",
  pipelineId: "",
  ...values,
});
const emptySmartListForm = () => ({ nombre: "", logic: "AND", rules: [newFilterRule()] });
const newMessageVariant = (content = "") => ({
  key: `message-variant-${messageVariantSequence += 1}`,
  content,
});
const emptySavedMessageForm = () => ({ nombre: "", contenido: "" });
const toDateTimeLocal = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};
const parseEcuadorDateTime = (value) => new Date(`${value}${String(value).length === 16 ? ":00" : ""}-05:00`);
const formatDateTime = (value) => value
  ? new Date(value).toLocaleString("es-EC", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guayaquil" })
  : "-";
const executionStatusLabel = (item) => {
  if (item?.estado === "pending" && item?.scheduledAt && new Date(item.scheduledAt) > new Date()) {
    return "Programada";
  }
  return EXECUTION_STATUS[item?.estado] || item?.estado || "-";
};

const contactStatus = (contact) => {
  if (contact.canSend) {
    return <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-800">Disponible</span>;
  }
  return (
    <span title={contact.blockedReason || "No disponible"} className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">
      No disponible
    </span>
  );
};

export default function Difusiones() {
  const authUser = useAuthUser();
  const role = String(authUser?.rol?.nombre || "").trim().toLowerCase();
  const isAdmin = role === "admin" || role === "administrador";
  const [messageHub, setMessageHub] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [smartLists, setSmartLists] = useState([]);
  const [ghlTags, setGhlTags] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [activeSmartListId, setActiveSmartListId] = useState(null);
  const [editingSmartListId, setEditingSmartListId] = useState(null);
  const [smartListForm, setSmartListForm] = useState(emptySmartListForm);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [instances, setInstances] = useState(initialInstances);
  const [messages, setMessages] = useState(() => [newMessageVariant()]);
  const [savedMessages, setSavedMessages] = useState([]);
  const [savedMessageForm, setSavedMessageForm] = useState(emptySavedMessageForm);
  const [editingSavedMessageId, setEditingSavedMessageId] = useState(null);
  const [savedMessageEditorOpen, setSavedMessageEditorOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [execution, setExecution] = useState(null);
  const [batchSize, setBatchSize] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [sendMode, setSendMode] = useState("immediate");
  const [scheduledAt, setScheduledAt] = useState("");
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [smartListsLoading, setSmartListsLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [savingSmartList, setSavingSmartList] = useState(false);
  const [savedMessagesLoading, setSavedMessagesLoading] = useState(false);
  const [savingSavedMessage, setSavingSavedMessage] = useState(false);
  const [error, setError] = useState("");

  const selectedList = useMemo(() => Object.values(selectedContacts), [selectedContacts]);
  const selectedInstances = useMemo(
    () => instances.filter((instance) => instance.selected),
    [instances],
  );
  const instanceLabel = useCallback((index) => `Instancia ${index}`, []);
  const activeSmartList = useMemo(
    () => smartLists.find((list) => String(list.id) === String(activeSmartListId)) || null,
    [activeSmartListId, smartLists],
  );
  const executionActive = ["pending", "running"].includes(execution?.estado);
  const messageContents = messages.map((item) => item.content);
  const allMessagesValid = messageContents.length > 0
    && messageContents.every((content) => content.trim());
  const effectiveBatchSize = Math.min(batchSize, selectedInstances.length);
  const estimatedBatches = selectedList.length && effectiveBatchSize > 0
    ? Math.ceil(selectedList.length / effectiveBatchSize)
    : 0;
  const estimatedMinutes = estimatedBatches > 0
    ? Math.max(0, estimatedBatches - 1) * intervalMinutes
    : 0;
  const scheduleIsValid = sendMode === "immediate"
    || (scheduledAt && parseEcuadorDateTime(scheduledAt).getTime() >= Date.now() - 60 * 1000);

  const invalidatePreview = () => {
    setPreview(null);
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/api/ghl/difusiones/estado");
      setMessageHub(response.data.messageHub || null);
    } catch (requestError) {
      setMessageHub(null);
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    setError("");
    try {
      const endpoint = activeSmartListId
        ? `/api/ghl/difusiones/listas/${activeSmartListId}/contactos`
        : "/api/ghl/difusiones/contactos";
      const response = await api.get(endpoint, {
        params: activeSmartListId
          ? { page, pageSize }
          : { query, page, pageSize },
      });
      setContacts(response.data.contacts || []);
      setPagination(response.data.pagination || { page, pageSize, total: 0, totalPages: 1 });
    } catch (requestError) {
      setContacts([]);
      setError(errorMessage(requestError));
    } finally {
      setContactsLoading(false);
    }
  }, [activeSmartListId, page, pageSize, query]);

  const loadSmartLists = useCallback(async () => {
    if (!isAdmin) return;
    setSmartListsLoading(true);
    try {
      const response = await api.get("/api/ghl/difusiones/listas");
      setSmartLists(response.data.listas || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSmartListsLoading(false);
    }
  }, [isAdmin]);

  const loadGhlTags = useCallback(async () => {
    if (!isAdmin) return;
    setTagsLoading(true);
    try {
      const response = await api.get("/api/ghl/difusiones/etiquetas");
      setGhlTags(response.data.tags || []);
    } catch (requestError) {
      setGhlTags([]);
      setError(errorMessage(requestError));
    } finally {
      setTagsLoading(false);
    }
  }, [isAdmin]);

  const loadPipelines = useCallback(async () => {
    if (!isAdmin) return;
    setPipelinesLoading(true);
    try {
      const response = await api.get("/api/ghl/difusiones/catalogos/pipelines");
      setPipelines(response.data.pipelines || []);
    } catch (requestError) {
      setPipelines([]);
      setError(errorMessage(requestError));
    } finally {
      setPipelinesLoading(false);
    }
  }, [isAdmin]);

  const loadSavedMessages = useCallback(async () => {
    if (!isAdmin) return;
    setSavedMessagesLoading(true);
    try {
      const response = await api.get("/api/ghl/difusiones/mensajes");
      setSavedMessages(response.data.mensajes || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavedMessagesLoading(false);
    }
  }, [isAdmin]);

  const loadActiveExecution = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/api/ghl/difusiones/ejecuciones/activa");
      if (response.data.execution) setExecution(response.data.execution);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [isAdmin]);

  const loadExecutionHistory = useCallback(async () => {
    if (!isAdmin) return;
    setHistoryLoading(true);
    try {
      const response = await api.get("/api/ghl/difusiones/ejecuciones", {
        params: { page: historyPage, pageSize: 10 },
      });
      setExecutionHistory(response.data.executions || []);
      setHistoryPagination(response.data.pagination || {
        page: historyPage,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      });
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, isAdmin]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadSmartLists();
  }, [loadSmartLists]);

  useEffect(() => {
    loadGhlTags();
  }, [loadGhlTags]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    loadSavedMessages();
  }, [loadSavedMessages]);

  useEffect(() => {
    loadActiveExecution();
  }, [loadActiveExecution]);

  useEffect(() => {
    loadExecutionHistory();
  }, [loadExecutionHistory]);

  useEffect(() => {
    if (!execution?.id || !["pending", "running"].includes(execution.estado)) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const response = await api.get(`/api/ghl/difusiones/ejecuciones/${execution.id}`);
        if (active) {
          const nextExecution = response.data.execution || null;
          setExecution(nextExecution);
          if (nextExecution && !["pending", "running"].includes(nextExecution.estado)) {
            loadExecutionHistory();
          }
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError));
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [execution?.estado, execution?.id, loadExecutionHistory]);

  const toggleContact = (contact) => {
    if (!contact.canSend) return;
    invalidatePreview();
    setSelectedContacts((current) => {
      const next = { ...current };
      if (next[contact.id]) delete next[contact.id];
      else next[contact.id] = contact;
      return next;
    });
  };

  const eligiblePageContacts = contacts.filter((contact) => contact.canSend);
  const allPageSelected = eligiblePageContacts.length > 0 && eligiblePageContacts.every((contact) => selectedContacts[contact.id]);

  const toggleCurrentPage = () => {
    invalidatePreview();
    setSelectedContacts((current) => {
      const next = { ...current };
      eligiblePageContacts.forEach((contact) => {
        if (allPageSelected) delete next[contact.id];
        else if (Object.keys(next).length < 100) next[contact.id] = contact;
      });
      return next;
    });
  };

  const updateInstance = (index, patch) => {
    invalidatePreview();
    setInstances((current) => current.map(
      (instance) => instance.index === index ? { ...instance, ...patch } : instance,
    ));
  };

  const payload = () => ({
    contactIds: selectedList.map((contact) => contact.id),
    instanceIndexes: selectedInstances.map((instance) => instance.index),
    messages: messageContents,
    batchSize,
    intervalMinutes,
    scheduledAt: sendMode === "scheduled" && scheduledAt
      ? parseEcuadorDateTime(scheduledAt).toISOString()
      : undefined,
  });

  const runPreview = async () => {
    setPreviewing(true);
    setError("");
    try {
      const response = await api.post("/api/ghl/difusiones/vista-previa", payload());
      setPreview(response.data.preview || null);
    } catch (requestError) {
      setPreview(null);
      setError(errorMessage(requestError));
    } finally {
      setPreviewing(false);
    }
  };

  const sendBroadcast = async () => {
    if (!preview || executionActive) return;
    if (!scheduleIsValid) {
      setError("Seleccione una fecha y hora actual o futura para programar la difusion.");
      return;
    }
    const scheduleDescription = sendMode === "scheduled"
      ? `Se iniciara el ${formatDateTime(parseEcuadorDateTime(scheduledAt).toISOString())}`
      : "Se iniciara inmediatamente";
    const confirmed = window.confirm(
      `${scheduleDescription}. Se enviaran ${preview.totalEligible} mensajes en lotes de hasta ${effectiveBatchSize} cada ${intervalMinutes} minutos, con maximo uno por extension. A los contactos se agregara la etiqueta regestion. ¿Desea continuar?`,
    );
    if (!confirmed) return;

    setSending(true);
    setError("");
    try {
      const response = await api.post("/api/ghl/difusiones/enviar", {
        ...payload(),
        confirmation: "ENVIAR",
      });
      setExecution(response.data.execution || null);
      setPreview(null);
      setHistoryPage(1);
      await loadExecutionHistory();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSending(false);
    }
  };

  const cancelBroadcast = async () => {
    if (!executionActive || !execution?.id) return;
    if (!window.confirm("Se cancelaran los contactos que aun no han sido procesados. ¿Desea continuar?")) return;
    try {
      const response = await api.post(`/api/ghl/difusiones/ejecuciones/${execution.id}/cancelar`);
      setExecution(response.data.execution || null);
      await loadExecutionHistory();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const viewExecution = async (id) => {
    try {
      const response = await api.get(`/api/ghl/difusiones/ejecuciones/${id}`);
      setHistoryDetail(response.data.execution || null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const searchContacts = (event) => {
    event.preventDefault();
    setActiveSmartListId(null);
    setSelectedContacts({});
    setPage(1);
    setQuery(searchDraft.trim());
  };

  const applySmartList = (list) => {
    invalidatePreview();
    setSelectedContacts({});
    setSearchDraft("");
    setQuery("");
    setPage(1);
    setActiveSmartListId(list.id);
    setFilterDrawerOpen(false);
  };

  const clearSmartList = () => {
    invalidatePreview();
    setSelectedContacts({});
    setActiveSmartListId(null);
    setPage(1);
  };

  const startEditSmartList = (list) => {
    setEditingSmartListId(list.id);
    setSmartListForm({
      nombre: list.nombre || "",
      logic: "AND",
      rules: (list.filtros?.rules || []).map((rule) => newFilterRule(rule)),
    });
    setFilterDrawerOpen(true);
  };

  const startNewSmartList = () => {
    setEditingSmartListId(null);
    setSmartListForm(emptySmartListForm());
    setFilterDrawerOpen(true);
  };

  const resetSmartListForm = () => {
    setEditingSmartListId(null);
    setSmartListForm(emptySmartListForm());
    setFilterDrawerOpen(false);
  };

  const updateFilterRule = (key, patch) => {
    setSmartListForm((current) => ({
      ...current,
      rules: current.rules.map((rule) => {
        if (rule.key !== key) return rule;
        const next = { ...rule, ...patch };
        if (patch.field === "query") next.operator = "contains";
        if (patch.field === "pipelineStageId") next.operator = "eq";
        if (patch.field) next.pipelineId = "";
        return next;
      }),
    }));
  };

  const addFilterRule = () => {
    setSmartListForm((current) => current.rules.length >= 10
      ? current
      : { ...current, rules: [...current.rules, newFilterRule()] });
  };

  const removeFilterRule = (key) => {
    setSmartListForm((current) => ({
      ...current,
      rules: current.rules.length === 1
        ? [newFilterRule()]
        : current.rules.filter((rule) => rule.key !== key),
    }));
  };

  const saveSmartList = async (event) => {
    event.preventDefault();
    setSavingSmartList(true);
    setError("");
    try {
      const body = {
        nombre: smartListForm.nombre,
        filtros: {
          logic: "AND",
          rules: smartListForm.rules.map(({ field, operator, value, pipelineId }) => ({
            field,
            operator: field === "query" ? "contains" : operator,
            value,
            ...(field === "pipelineStageId" ? { pipelineId } : {}),
          })),
        },
      };
      const response = editingSmartListId
        ? await api.put(`/api/ghl/difusiones/listas/${editingSmartListId}`, body)
        : await api.post("/api/ghl/difusiones/listas", body);
      const savedList = response.data.lista;
      const editedActiveList = Boolean(editingSmartListId)
        && String(activeSmartListId) === String(editingSmartListId);
      resetSmartListForm();
      await loadSmartLists();
      if (!editingSmartListId && savedList) applySmartList(savedList);
      else if (editedActiveList) await loadContacts();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavingSmartList(false);
    }
  };

  const deleteSmartList = async (list) => {
    if (!window.confirm(`Se eliminara la lista inteligente "${list.nombre}". ¿Desea continuar?`)) return;
    setError("");
    try {
      await api.delete(`/api/ghl/difusiones/listas/${list.id}`);
      if (String(activeSmartListId) === String(list.id)) clearSmartList();
      if (String(editingSmartListId) === String(list.id)) resetSmartListForm();
      await loadSmartLists();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const updateMessageVariant = (key, content) => {
    invalidatePreview();
    setMessages((current) => current.map((item) => item.key === key ? { ...item, content } : item));
  };

  const addMessageVariant = (content = "") => {
    invalidatePreview();
    setMessages((current) => {
      if (current.length >= 10) return current;
      if (content && current.length === 1 && !current[0].content.trim()) {
        return [{ ...current[0], content }];
      }
      return [...current, newMessageVariant(content)];
    });
  };

  const removeMessageVariant = (key) => {
    invalidatePreview();
    setMessages((current) => current.length === 1
      ? [newMessageVariant()]
      : current.filter((item) => item.key !== key));
  };

  const openNewSavedMessage = (content = "") => {
    setEditingSavedMessageId(null);
    setSavedMessageForm({ nombre: "", contenido: content });
    setSavedMessageEditorOpen(true);
  };

  const openEditSavedMessage = (savedMessage) => {
    setEditingSavedMessageId(savedMessage.id);
    setSavedMessageForm({ nombre: savedMessage.nombre, contenido: savedMessage.contenido });
    setSavedMessageEditorOpen(true);
  };

  const closeSavedMessageEditor = () => {
    setEditingSavedMessageId(null);
    setSavedMessageForm(emptySavedMessageForm());
    setSavedMessageEditorOpen(false);
  };

  const saveSavedMessage = async (event) => {
    event.preventDefault();
    setSavingSavedMessage(true);
    setError("");
    try {
      if (editingSavedMessageId) {
        await api.put(`/api/ghl/difusiones/mensajes/${editingSavedMessageId}`, savedMessageForm);
      } else {
        await api.post("/api/ghl/difusiones/mensajes", savedMessageForm);
      }
      closeSavedMessageEditor();
      await loadSavedMessages();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSavingSavedMessage(false);
    }
  };

  const deleteSavedMessage = async (savedMessage) => {
    if (!window.confirm(`Se eliminara el mensaje guardado "${savedMessage.nombre}". ¿Desea continuar?`)) return;
    setError("");
    try {
      await api.delete(`/api/ghl/difusiones/mensajes/${savedMessage.id}`);
      if (String(editingSavedMessageId) === String(savedMessage.id)) closeSavedMessageEditor();
      await loadSavedMessages();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  return (
    <div className="min-h-screen space-y-5 bg-gray-50 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-green-700">GoHighLevel · Message Hub</div>
          <h1 className="text-2xl font-bold text-gray-900">Difusion de mensajes</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Seleccione clientes, combine varios mensajes y distribuya el envio de forma equilibrada entre sus numeros de WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { loadStatus(); loadContacts(); loadSmartLists(); loadGhlTags(); loadPipelines(); loadSavedMessages(); }}
          disabled={loading || contactsLoading}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm disabled:opacity-50"
        >
          <RefreshCcw size={17} className={loading || contactsLoading ? "animate-spin" : ""} /> Actualizar
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className={`rounded-xl border p-4 shadow-sm ${messageHub?.configured ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white p-2 text-green-700 shadow-sm"><Smartphone size={21} /></div>
            <div>
              <h2 className="font-bold text-gray-900">Proveedor de salida</h2>
              <p className="text-sm text-gray-600">
                {loading ? "Verificando Message Hub..." : messageHub?.configured ? `${messageHub.providerName} esta disponible en GHL.` : "Message Hub no esta disponible."}
              </p>
            </div>
          </div>
          {messageHub?.configured && <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800"><CheckCircle2 size={14} /> Configurado</span>}
        </div>
      </section>

      {isAdmin && (
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b px-4 pt-4">
            <ListFilter size={20} className="mb-3 shrink-0 text-green-700" />
            <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
              <button type="button" onClick={clearSmartList} className={`whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-bold ${!activeSmartListId ? "border-green-600 text-green-700" : "border-transparent text-gray-500"}`}>Todo</button>
              {smartLists.map((list) => (
                <button key={list.id} type="button" onClick={() => applySmartList(list)} className={`max-w-52 truncate whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-bold ${String(activeSmartListId) === String(list.id) ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-900"}`} title={list.nombre}>
                  {list.nombre}
                </button>
              ))}
              {smartListsLoading && <LoaderCircle size={17} className="mb-3 ml-2 animate-spin text-gray-400" />}
              <button type="button" onClick={startNewSmartList} className="mb-2 inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-100"><Plus size={16} /> Anadir</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => activeSmartList ? startEditSmartList(activeSmartList) : startNewSmartList()} className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white px-3 py-1.5 text-sm font-bold text-green-700 shadow-sm">
                <SlidersHorizontal size={16} /> Filtros {activeSmartList ? `(${activeSmartList.filtros?.rules?.length || 0})` : ""}
              </button>
              {activeSmartList && <span className="text-xs text-gray-500">Los filtros se combinan con AND.</span>}
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">{pagination.total.toLocaleString("es-EC")} contactos</span>
          </div>
        </section>
      )}

      {isAdmin && filterDrawerOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-black/35" onClick={resetSmartListForm} aria-label="Cerrar filtros" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-2xl">
            <form onSubmit={saveSmartList} className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
                  <p className="text-xs text-gray-500">{editingSmartListId ? "Editar lista inteligente" : "Nueva lista inteligente"}</p>
                </div>
                <button type="button" onClick={resetSmartListForm} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Cerrar"><X size={19} /></button>
              </div>

              <div className="border-b p-5">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500" htmlFor="smart-list-name">Nombre de la lista</label>
                <input
                  id="smart-list-name"
                  value={smartListForm.nombre}
                  onChange={(event) => setSmartListForm((current) => ({ ...current, nombre: event.target.value }))}
                  maxLength="120"
                  placeholder="Ej. BDD UPHONE sin regestion"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  required
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="space-y-0">
                  {smartListForm.rules.map((rule, index) => (
                    <div key={rule.key}>
                      {index > 0 && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="h-px flex-1 bg-gray-200" />
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500">AND</span>
                          <div className="h-px flex-1 bg-gray-200" />
                        </div>
                      )}
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <select value={rule.field} onChange={(event) => updateFilterRule(rule.key, { field: event.target.value, value: "" })} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500">
                            {FILTER_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                          </select>
                          <select value={rule.field === "query" ? "contains" : rule.field === "pipelineStageId" ? "eq" : rule.operator} onChange={(event) => updateFilterRule(rule.key, { operator: event.target.value })} disabled={rule.field === "query" || rule.field === "pipelineStageId"} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 disabled:bg-gray-100">
                            {(rule.field === "query"
                              ? FILTER_OPERATORS.filter((operator) => operator.value === "contains")
                              : rule.field === "pipelineStageId"
                                ? FILTER_OPERATORS.filter((operator) => operator.value === "eq")
                                : FILTER_OPERATORS).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                          </select>
                          <button type="button" onClick={() => removeFilterRule(rule.key)} className="rounded-lg border border-gray-300 bg-white p-2.5 text-gray-500 hover:border-red-200 hover:text-red-600" aria-label="Eliminar filtro"><Trash2 size={17} /></button>
                        </div>
                        {rule.field === "tags" ? (
                          <select
                            value={rule.value}
                            onChange={(event) => updateFilterRule(rule.key, { value: event.target.value })}
                            disabled={tagsLoading}
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 disabled:bg-gray-100"
                            required
                          >
                            <option value="">{tagsLoading ? "Cargando etiquetas de GHL..." : "Seleccione una etiqueta de GHL"}</option>
                            {ghlTags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
                          </select>
                        ) : rule.field === "pipelineStageId" ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <select
                              value={rule.pipelineId || ""}
                              onChange={(event) => updateFilterRule(rule.key, { pipelineId: event.target.value, value: "" })}
                              disabled={pipelinesLoading}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 disabled:bg-gray-100"
                              required
                            >
                              <option value="">{pipelinesLoading ? "Cargando pipelines de GHL..." : "Seleccione un pipeline"}</option>
                              {pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}
                            </select>
                            <select
                              value={rule.value}
                              onChange={(event) => updateFilterRule(rule.key, { value: event.target.value })}
                              disabled={!rule.pipelineId || pipelinesLoading}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 disabled:bg-gray-100"
                              required
                            >
                              <option value="">Seleccione una etapa</option>
                              {(pipelines.find((pipeline) => String(pipeline.id) === String(rule.pipelineId))?.stages || []).map((stage) => (
                                <option key={stage.id} value={stage.id}>{stage.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <input
                            value={rule.value}
                            onChange={(event) => updateFilterRule(rule.key, { value: event.target.value })}
                            maxLength="150"
                            placeholder="Escriba el valor del filtro"
                            className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500"
                            required
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={addFilterRule} disabled={smartListForm.rules.length >= 10} className="mt-4 inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm disabled:opacity-40">
                  <Plus size={17} /> Anadir filtro
                </button>
                <p className="mt-3 text-xs text-gray-500">Puede agregar hasta 10 condiciones. Todas deben cumplirse para que el contacto aparezca en la lista.</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white p-4">
                <div>
                  {editingSmartListId && activeSmartList && String(editingSmartListId) === String(activeSmartList.id) && (
                    <button type="button" onClick={() => deleteSmartList(activeSmartList)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600"><Trash2 size={16} /> Eliminar lista</button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={resetSmartListForm} className="rounded-lg border px-4 py-2 text-sm font-bold text-gray-600">Cancelar</button>
                  <button type="submit" disabled={savingSmartList} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {savingSmartList ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />} Guardar lista
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </>
      )}

      {isAdmin && savedMessageEditorOpen && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-black/35" onClick={closeSavedMessageEditor} aria-label="Cerrar editor de mensaje" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <form onSubmit={saveSavedMessage} className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{editingSavedMessageId ? "Editar mensaje guardado" : "Guardar mensaje"}</h2>
                  <p className="text-xs text-gray-500">Disponible para futuras difusiones.</p>
                </div>
                <button type="button" onClick={closeSavedMessageEditor} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Cerrar"><X size={19} /></button>
              </div>
              <div className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Nombre
                  <input
                    value={savedMessageForm.nombre}
                    onChange={(event) => setSavedMessageForm((current) => ({ ...current, nombre: event.target.value }))}
                    maxLength="120"
                    placeholder="Ej. Seguimiento inicial"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    required
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                  Contenido
                  <textarea
                    value={savedMessageForm.contenido}
                    onChange={(event) => setSavedMessageForm((current) => ({ ...current, contenido: event.target.value }))}
                    rows="7"
                    maxLength="4000"
                    className="mt-2 w-full resize-y rounded-lg border border-gray-300 p-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    required
                  />
                </label>
                <div className="text-right text-xs text-gray-500">{savedMessageForm.contenido.length}/4000</div>
              </div>
              <div className="flex justify-end gap-2 border-t bg-gray-50 p-4">
                <button type="button" onClick={closeSavedMessageEditor} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold text-gray-600">Cancelar</button>
                <button type="submit" disabled={savingSavedMessage} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {savingSavedMessage ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />} Guardar
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><Users size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Clientes de GHL</h2></div>
                <p className="mt-1 text-xs text-gray-500">{selectedList.length} seleccionados · maximo 100 por difusion</p>
                {activeSmartList && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                    <ListFilter size={14} /> {activeSmartList.nombre}
                    <button type="button" onClick={clearSmartList} className="rounded-full text-green-900" aria-label="Quitar lista inteligente"><X size={14} /></button>
                  </div>
                )}
              </div>
              <form onSubmit={searchContacts} className="flex min-w-[260px] flex-1 gap-2 sm:max-w-md">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Nombre, telefono o correo"
                    className="h-9 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>
                <button type="submit" className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white">Buscar</button>
              </form>
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleCurrentPage} aria-label="Seleccionar pagina" />
                  </th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Telefono</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((contact) => (
                  <tr key={contact.id} className={contact.canSend ? "hover:bg-green-50/40" : "bg-gray-50 text-gray-400"}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedContacts[contact.id])}
                        disabled={!contact.canSend || (selectedList.length >= 100 && !selectedContacts[contact.id])}
                        onChange={() => toggleContact(contact)}
                        aria-label={`Seleccionar ${contact.name}`}
                      />
                    </td>
                    <td className="px-4 py-3"><div className="font-semibold text-gray-900">{contact.name}</div><div className="text-xs text-gray-500">{contact.email || "Sin correo"}</div></td>
                    <td className="whitespace-nowrap px-4 py-3">{contact.phone || "—"}</td>
                    <td className="px-4 py-3 text-xs">{contact.source || "Sin origen"}</td>
                    <td className="px-4 py-3">{contactStatus(contact)}{contact.blockedReason && <div className="mt-1 max-w-[180px] text-xs text-red-600">{contact.blockedReason}</div>}</td>
                  </tr>
                ))}
                {contactsLoading && <tr><td colSpan="5" className="p-10 text-center text-gray-500"><LoaderCircle size={20} className="mr-2 inline animate-spin" />Cargando clientes...</td></tr>}
                {!contactsLoading && !contacts.length && <tr><td colSpan="5" className="p-10 text-center text-gray-500">No se encontraron clientes.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-gray-600">
            <div className="flex flex-wrap items-center gap-3">
              <span>{pagination.total.toLocaleString("es-EC")} clientes · pagina {pagination.page} de {pagination.totalPages}</span>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600">
                Mostrar
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  disabled={contactsLoading}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:opacity-50"
                  aria-label="Cantidad de clientes por pagina"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                clientes
              </label>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || contactsLoading} className="rounded border p-2 disabled:opacity-40"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || contactsLoading} className="rounded border p-2 disabled:opacity-40"><ChevronRight size={17} /></button>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><MessageSquareText size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Mensajes ({messages.length}/10)</h2></div>
              <button type="button" onClick={() => addMessageVariant()} disabled={messages.length >= 10} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-40"><Plus size={15} /> Variante</button>
            </div>
            <p className="mb-3 text-xs text-gray-500">Los textos se alternaran en orden entre los destinatarios.</p>
            <div className="space-y-3">
              {messages.map((item, index) => (
                <div key={item.key} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-gray-600">Variante {index + 1}</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openNewSavedMessage(item.content)} disabled={!item.content.trim()} className="rounded p-1.5 text-green-700 hover:bg-green-100 disabled:opacity-30" title="Guardar en biblioteca"><Save size={15} /></button>
                      <button type="button" onClick={() => removeMessageVariant(item.key)} className="rounded p-1.5 text-red-600 hover:bg-red-100" title="Quitar variante"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <textarea
                    value={item.content}
                    onChange={(event) => updateMessageVariant(item.key, event.target.value)}
                    rows="5"
                    maxLength="4000"
                    placeholder="Escriba el texto que recibiran los clientes..."
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white p-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                  <div className="mt-1 text-right text-xs text-gray-500">{item.content.length}/4000</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><BookOpen size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Biblioteca</h2></div>
              <button type="button" onClick={() => openNewSavedMessage()} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-gray-700"><Plus size={15} /> Nuevo</button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {savedMessages.map((savedMessage) => (
                <div key={savedMessage.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-gray-800" title={savedMessage.nombre}>{savedMessage.nombre}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{savedMessage.contenido}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => addMessageVariant(savedMessage.contenido)} disabled={messages.length >= 10} className="rounded bg-green-50 px-2 py-1 text-xs font-bold text-green-700 disabled:opacity-40">Usar</button>
                      <button type="button" onClick={() => openEditSavedMessage(savedMessage)} className="rounded p-1.5 text-gray-600 hover:bg-gray-100" title="Editar"><Pencil size={14} /></button>
                      <button type="button" onClick={() => deleteSavedMessage(savedMessage)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {savedMessagesLoading && <div className="py-5 text-center text-xs text-gray-500"><LoaderCircle size={17} className="mr-2 inline animate-spin" />Cargando mensajes...</div>}
              {!savedMessagesLoading && !savedMessages.length && <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">Aun no hay mensajes guardados.</div>}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Smartphone size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Canales de salida</h2></div>
            <p className="mb-3 text-xs text-gray-500">
              Ninguna instancia se selecciona automaticamente. Marque solo las que esten conectadas en Message Hub.
            </p>
            <div className="space-y-2">
              {instances.map((instance) => (
                <label key={instance.index} className={`flex items-center gap-3 rounded-lg border p-3 ${instance.selected ? "border-green-300 bg-green-50" : "bg-gray-50"}`}>
                  <input type="checkbox" checked={instance.selected} onChange={(event) => updateInstance(instance.index, { selected: event.target.checked })} />
                  <span className="text-sm font-bold text-gray-700">Instancia {instance.index}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><Timer size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Cadencia de envio</h2></div>
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${sendMode === "immediate" ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                <input
                  type="radio"
                  name="sendMode"
                  value="immediate"
                  checked={sendMode === "immediate"}
                  onChange={() => { setSendMode("immediate"); invalidatePreview(); }}
                />
                <span><strong className="block text-sm text-gray-800">Enviar ahora</strong><span className="text-xs text-gray-500">Inicia al confirmar.</span></span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${sendMode === "scheduled" ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
                <input
                  type="radio"
                  name="sendMode"
                  value="scheduled"
                  checked={sendMode === "scheduled"}
                  onChange={() => { setSendMode("scheduled"); invalidatePreview(); }}
                />
                <span><strong className="block text-sm text-gray-800">Programar fecha y hora</strong><span className="text-xs text-gray-500">La cola iniciara en el momento indicado.</span></span>
              </label>
            </div>
            {sendMode === "scheduled" && (
              <label className="mb-4 block text-xs font-bold text-gray-600">
                Fecha y hora de inicio (Ecuador)
                <input
                  type="datetime-local"
                  min={toDateTimeLocal(new Date())}
                  value={scheduledAt}
                  onChange={(event) => { setScheduledAt(event.target.value); invalidatePreview(); }}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500"
                />
                {!scheduleIsValid && <span className="mt-1 block font-medium text-red-600">Seleccione una fecha y hora actual o futura.</span>}
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-gray-600">
                Max. mensajes por lote
                <input type="number" min="1" max="20" value={batchSize} onChange={(event) => { setBatchSize(Number(event.target.value)); invalidatePreview(); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500" />
              </label>
              <label className="text-xs font-bold text-gray-600">
                Cada cuantos minutos
                <input type="number" min="1" max="1440" value={intervalMinutes} onChange={(event) => { setIntervalMinutes(Number(event.target.value)); invalidatePreview(); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500" />
              </label>
            </div>
            <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-xs text-green-800">
              Predeterminado: <strong>hasta 3 mensajes cada 5 minutos</strong>, con maximo uno por extension en cada lote. La etiqueta <strong>regestion</strong> se agregara a todos los contactos seleccionados.
            </div>
            <p className="mt-2 text-xs text-gray-500">Estimado actual: {estimatedBatches} lotes durante aproximadamente {estimatedMinutes} minutos.</p>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-xl font-bold text-gray-900">{selectedList.length}</div><div className="text-xs text-gray-500">Clientes</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-xl font-bold text-gray-900">{selectedInstances.length}</div><div className="text-xs text-gray-500">Numeros</div></div>
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-xl font-bold text-gray-900">{selectedInstances.length ? Math.ceil(selectedList.length / selectedInstances.length) : 0}</div><div className="text-xs text-gray-500">Max. por numero</div></div>
            </div>
            <button
              type="button"
              onClick={runPreview}
              disabled={previewing || sending || !allMessagesValid || !selectedList.length || !selectedInstances.length || !messageHub?.configured || batchSize < 1 || intervalMinutes < 1 || !scheduleIsValid}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {previewing ? <LoaderCircle size={17} className="animate-spin" /> : <Eye size={17} />} Generar vista previa
            </button>
          </section>
        </div>
      </div>

      {preview && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-blue-950">Vista previa del reparto</h2>
              <p className="text-sm text-blue-800">{preview.totalEligible} envios · {preview.totalExcluded} excluidos · reparto equilibrado entre {preview.distribution.length} numeros.</p>
              <p className="mt-1 text-xs font-semibold text-blue-700">{preview.messageCount || messages.length} variantes alternadas · hasta {effectiveBatchSize} envios cada {intervalMinutes} minutos · maximo uno por extension · etiqueta regestion.</p>
              <p className="mt-1 text-xs font-semibold text-blue-700">
                {sendMode === "scheduled" ? `Inicio programado: ${formatDateTime(parseEcuadorDateTime(scheduledAt).toISOString())}` : "Inicio inmediato al confirmar."}
              </p>
            </div>
            <button type="button" onClick={() => setPreview(null)} className="text-blue-900"><X size={19} /></button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {preview.distribution.map((group) => (
              <div key={group.instanceIndex} className="rounded-lg border border-blue-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-gray-900">{instanceLabel(group.instanceIndex)}</strong><span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">{group.count}</span></div>
                <div className="mt-1 text-xs font-semibold text-gray-500">WA#{group.instanceIndex}</div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-gray-600">
                  {group.contacts.map((contact) => <li key={contact.id} className="truncate" title={contact.name}>{contact.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
          {preview.excluded.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Excluidos:</strong> {preview.excluded.map((contact) => `${contact.name} (${contact.blockedReason})`).join(", ")}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={sendBroadcast} disabled={sending || executionActive} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">
              {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />} {sending ? "Guardando..." : executionActive ? "Ya existe una difusion activa o programada" : sendMode === "scheduled" ? `Programar ${preview.totalEligible} envios` : `Enviar ahora a ${preview.totalEligible}`}
            </button>
          </div>
        </section>
      )}

      {execution && (
        <section className={`rounded-xl border p-4 shadow-sm ${execution.estado === "partial" ? "border-amber-200 bg-amber-50" : execution.estado === "cancelled" ? "border-gray-300 bg-gray-50" : "border-green-200 bg-green-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><CheckCircle2 size={20} className={execution.estado === "partial" ? "text-amber-700" : "text-green-700"} /><h2 className="font-bold text-gray-900">Difusion #{execution.id} · {executionStatusLabel(execution)}</h2></div>
              <p className="mt-1 text-sm text-gray-700">{execution.processed || 0} de {execution.total || 0} procesados · {execution.sent || 0} enviados · {execution.failed || 0} fallidos.</p>
              <p className="mt-1 text-xs text-gray-600">Etiqueta regestion: {execution.tagged || 0} aplicadas · {execution.tagFailed || 0} fallidas.</p>
              {execution.scheduledAt && <p className="mt-1 text-xs text-gray-600">Inicio solicitado: {formatDateTime(execution.scheduledAt)}</p>}
              {executionActive && execution.nextBatchAt && <p className="mt-1 text-xs font-semibold text-green-800">{execution.estado === "pending" ? "Inicio o siguiente lote" : "Siguiente lote"}: {formatDateTime(execution.nextBatchAt)}</p>}
            </div>
            {executionActive && <button type="button" onClick={cancelBroadcast} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600">Cancelar pendientes</button>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full bg-green-600 transition-all" style={{ width: `${execution.total ? Math.min(100, ((execution.processed || 0) / execution.total) * 100) : 0}%` }} />
          </div>
          {(execution.details || []).some((item) => item.estado === "failed" || item.tagStatus === "failed") && (
            <div className="mt-3 overflow-x-auto rounded-lg border bg-white">
              <table className="min-w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Canal</th><th className="px-3 py-2">Novedad</th></tr></thead><tbody className="divide-y">{execution.details.filter((item) => item.estado === "failed" || item.tagStatus === "failed").map((item) => <tr key={item.id}><td className="px-3 py-2">{item.contactName}</td><td className="px-3 py-2">{instanceLabel(item.instanceIndex)}</td><td className="px-3 py-2 text-red-700">{[item.sendError, item.tagError].filter(Boolean).join(" · ")}</td></tr>)}</tbody></table>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="flex items-center gap-2"><History size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Historial de difusiones</h2></div>
            <p className="mt-1 text-xs text-gray-500">Ejecuciones inmediatas y programadas, con sus resultados y canales utilizados.</p>
          </div>
          <button type="button" onClick={loadExecutionHistory} disabled={historyLoading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50">
            <RefreshCcw size={15} className={historyLoading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr><th className="px-4 py-3">Difusion</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Configuracion</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3 text-right">Accion</th></tr>
            </thead>
            <tbody className="divide-y">
              {executionHistory.map((item) => (
                <tr key={item.id} className="align-top hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900">#{item.id}</div>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-bold ${item.estado === "completed" ? "bg-green-100 text-green-800" : item.estado === "partial" ? "bg-amber-100 text-amber-800" : item.estado === "cancelled" ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-800"}`}>{executionStatusLabel(item)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 font-semibold text-gray-800"><CalendarClock size={14} /> {formatDateTime(item.scheduledAt)}</div>
                    <div className="mt-1 text-xs text-gray-500">Creada: {formatDateTime(item.createdAt)}</div>
                    {item.finishedAt && <div className="mt-1 text-xs text-gray-500">Finalizada: {formatDateTime(item.finishedAt)}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{item.total || 0} clientes · {item.messageCount || 1} variantes</div>
                    <div className="mt-1 text-xs text-gray-500">Hasta {Math.min(item.batchSize || 0, (item.instanceIndexes || []).length)} por lote · cada {item.intervalMinutes} min</div>
                    <div className="mt-1 text-xs text-gray-500">{(item.instanceIndexes || []).map((index) => `WA#${index}`).join(", ") || "Sin canales"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{item.sent || 0} enviados · {item.failed || 0} fallidos</div>
                    <div className="mt-1 text-xs text-gray-500">{item.processed || 0}/{item.total || 0} procesados · {item.tagged || 0} etiquetados</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.creadoPor?.nombre || "-"}</td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={() => viewExecution(item.id)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"><Eye size={14} /> Ver</button></td>
                </tr>
              ))}
              {!historyLoading && !executionHistory.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-500">Todavia no hay difusiones registradas.</td></tr>}
              {historyLoading && <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-500"><LoaderCircle size={18} className="mr-2 inline animate-spin" />Cargando historial...</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-gray-600">
          <span>{historyPagination.total || 0} difusiones registradas</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={historyPage <= 1 || historyLoading} className="rounded border p-1.5 disabled:opacity-40" aria-label="Pagina anterior del historial"><ChevronLeft size={16} /></button>
            <span>Pagina {historyPagination.page || historyPage} de {historyPagination.totalPages || 1}</span>
            <button type="button" onClick={() => setHistoryPage((current) => Math.min(historyPagination.totalPages || 1, current + 1))} disabled={historyPage >= (historyPagination.totalPages || 1) || historyLoading} className="rounded border p-1.5 disabled:opacity-40" aria-label="Pagina siguiente del historial"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {historyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 cursor-default bg-black/45" onClick={() => setHistoryDetail(null)} aria-label="Cerrar detalle" />
          <section className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
              <div>
                <h2 className="font-bold text-gray-900">Difusion #{historyDetail.id} · {executionStatusLabel(historyDetail)}</h2>
                <p className="mt-1 text-sm text-gray-600">Inicio solicitado: {formatDateTime(historyDetail.scheduledAt)}</p>
              </div>
              <button type="button" onClick={() => setHistoryDetail(null)} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 border-b p-5 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-3"><div className="text-xl font-bold text-gray-900">{historyDetail.total || 0}</div><div className="text-xs text-gray-500">Clientes</div></div>
              <div className="rounded-lg bg-green-50 p-3"><div className="text-xl font-bold text-green-800">{historyDetail.sent || 0}</div><div className="text-xs text-green-700">Enviados</div></div>
              <div className="rounded-lg bg-red-50 p-3"><div className="text-xl font-bold text-red-700">{historyDetail.failed || 0}</div><div className="text-xs text-red-600">Fallidos</div></div>
              <div className="rounded-lg bg-blue-50 p-3"><div className="text-xl font-bold text-blue-800">{historyDetail.tagged || 0}</div><div className="text-xs text-blue-700">Etiquetados</div></div>
            </div>
            <div className="max-h-[55vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Novedad</th></tr></thead>
                <tbody className="divide-y">
                  {(historyDetail.details || []).map((detail) => (
                    <tr key={detail.id}><td className="px-4 py-3 text-gray-800">{detail.contactName}</td><td className="px-4 py-3 text-gray-600">WA#{detail.instanceIndex}</td><td className="px-4 py-3 font-semibold text-gray-700">{DETAIL_STATUS[detail.estado] || detail.estado}</td><td className="px-4 py-3 text-red-700">{[detail.sendError, detail.tagError].filter(Boolean).join(" · ") || "-"}</td></tr>
                  ))}
                  {!(historyDetail.details || []).length && <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No hay detalles disponibles.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
