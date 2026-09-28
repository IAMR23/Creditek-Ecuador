import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ListFilter,
  LoaderCircle,
  MessageSquareText,
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
const FILTER_FIELDS = [
  { value: "tags", label: "Etiqueta" },
  { value: "source", label: "Origen" },
  { value: "query", label: "Nombre, telefono o correo" },
  { value: "firstName", label: "Nombre" },
  { value: "lastName", label: "Apellido" },
  { value: "email", label: "Correo electronico" },
  { value: "phone", label: "Telefono" },
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
let filterRuleSequence = 0;

const errorMessage = (error) =>
  error.response?.data?.message || error.message || "No se pudo completar la operacion";

const initialInstances = () => [1, 2, 3, 4, 5].map((index) => ({ index, selected: false }));
const newFilterRule = (values = {}) => ({
  key: `filter-rule-${filterRuleSequence += 1}`,
  field: "tags",
  operator: "eq",
  value: "",
  ...values,
});
const emptySmartListForm = () => ({ nombre: "", logic: "AND", rules: [newFilterRule()] });

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
  const [searchDraft, setSearchDraft] = useState("");
  const [query, setQuery] = useState("");
  const [smartLists, setSmartLists] = useState([]);
  const [ghlTags, setGhlTags] = useState([]);
  const [activeSmartListId, setActiveSmartListId] = useState(null);
  const [editingSmartListId, setEditingSmartListId] = useState(null);
  const [smartListForm, setSmartListForm] = useState(emptySmartListForm);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [instances, setInstances] = useState(initialInstances);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [execution, setExecution] = useState(null);
  const [batchSize, setBatchSize] = useState(3);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [smartListsLoading, setSmartListsLoading] = useState(false);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [savingSmartList, setSavingSmartList] = useState(false);
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
  const estimatedBatches = selectedList.length && batchSize > 0
    ? Math.ceil(selectedList.length / batchSize)
    : 0;
  const estimatedMinutes = estimatedBatches > 0
    ? Math.max(0, estimatedBatches - 1) * intervalMinutes
    : 0;

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
          ? { page, pageSize: PAGE_SIZE }
          : { query, page, pageSize: PAGE_SIZE },
      });
      setContacts(response.data.contacts || []);
      setPagination(response.data.pagination || { page, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (requestError) {
      setContacts([]);
      setError(errorMessage(requestError));
    } finally {
      setContactsLoading(false);
    }
  }, [activeSmartListId, page, query]);

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

  const loadActiveExecution = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/api/ghl/difusiones/ejecuciones/activa");
      if (response.data.execution) setExecution(response.data.execution);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [isAdmin]);

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
    loadActiveExecution();
  }, [loadActiveExecution]);

  useEffect(() => {
    if (!execution?.id || !["pending", "running"].includes(execution.estado)) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const response = await api.get(`/api/ghl/difusiones/ejecuciones/${execution.id}`);
        if (active) setExecution(response.data.execution || null);
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
  }, [execution?.estado, execution?.id]);

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
    message,
    batchSize,
    intervalMinutes,
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
    const confirmed = window.confirm(
      `Se programaran ${preview.totalEligible} mensajes en lotes de ${batchSize} cada ${intervalMinutes} minutos. A los contactos se agregara la etiqueta regestion. ¿Desea continuar?`,
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
          rules: smartListForm.rules.map(({ field, operator, value }) => ({
            field,
            operator: field === "query" ? "contains" : operator,
            value,
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

  return (
    <div className="min-h-screen space-y-5 bg-gray-50 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-green-700">GoHighLevel · Message Hub</div>
          <h1 className="text-2xl font-bold text-gray-900">Difusion de mensajes</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Seleccione clientes, escriba el mensaje y distribuya el envio de forma equilibrada entre sus numeros de WhatsApp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { loadStatus(); loadContacts(); loadSmartLists(); loadGhlTags(); }}
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
                          <select value={rule.field === "query" ? "contains" : rule.operator} onChange={(event) => updateFilterRule(rule.key, { operator: event.target.value })} disabled={rule.field === "query"} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 disabled:bg-gray-100">
                            {(rule.field === "query" ? FILTER_OPERATORS.filter((operator) => operator.value === "contains") : FILTER_OPERATORS).map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
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
            <span>{pagination.total.toLocaleString("es-EC")} clientes · pagina {pagination.page} de {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || contactsLoading} className="rounded border p-2 disabled:opacity-40"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages || contactsLoading} className="rounded border p-2 disabled:opacity-40"><ChevronRight size={17} /></button>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2"><MessageSquareText size={19} className="text-green-700" /><h2 className="font-bold text-gray-900">Mensaje</h2></div>
            <textarea
              value={message}
              onChange={(event) => { setMessage(event.target.value); invalidatePreview(); }}
              rows="7"
              maxLength="4000"
              placeholder="Escriba el texto que recibiran los clientes..."
              className="w-full resize-y rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            <div className="mt-1 text-right text-xs text-gray-500">{message.length}/4000</div>
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
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-gray-600">
                Mensajes por lote
                <input type="number" min="1" max="20" value={batchSize} onChange={(event) => { setBatchSize(Number(event.target.value)); invalidatePreview(); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500" />
              </label>
              <label className="text-xs font-bold text-gray-600">
                Cada cuantos minutos
                <input type="number" min="1" max="1440" value={intervalMinutes} onChange={(event) => { setIntervalMinutes(Number(event.target.value)); invalidatePreview(); }} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-green-500" />
              </label>
            </div>
            <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3 text-xs text-green-800">
              Predeterminado: <strong>3 mensajes cada 5 minutos</strong>. La etiqueta <strong>regestion</strong> se agregara a todos los contactos seleccionados.
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
              disabled={previewing || sending || !message.trim() || !selectedList.length || !selectedInstances.length || !messageHub?.configured || batchSize < 1 || intervalMinutes < 1}
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
              <p className="mt-1 text-xs font-semibold text-blue-700">{batchSize} mensajes cada {intervalMinutes} minutos · etiqueta regestion.</p>
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
              {sending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />} {sending ? "Programando..." : executionActive ? "Ya existe una difusion en curso" : `Programar ${preview.totalEligible} envios`}
            </button>
          </div>
        </section>
      )}

      {execution && (
        <section className={`rounded-xl border p-4 shadow-sm ${execution.estado === "partial" ? "border-amber-200 bg-amber-50" : execution.estado === "cancelled" ? "border-gray-300 bg-gray-50" : "border-green-200 bg-green-50"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><CheckCircle2 size={20} className={execution.estado === "partial" ? "text-amber-700" : "text-green-700"} /><h2 className="font-bold text-gray-900">Difusion #{execution.id} · {EXECUTION_STATUS[execution.estado] || execution.estado}</h2></div>
              <p className="mt-1 text-sm text-gray-700">{execution.processed || 0} de {execution.total || 0} procesados · {execution.sent || 0} enviados · {execution.failed || 0} fallidos.</p>
              <p className="mt-1 text-xs text-gray-600">Etiqueta regestion: {execution.tagged || 0} aplicadas · {execution.tagFailed || 0} fallidas.</p>
              {executionActive && execution.nextBatchAt && <p className="mt-1 text-xs font-semibold text-green-800">Siguiente lote: {new Date(execution.nextBatchAt).toLocaleString("es-EC")}</p>}
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
    </div>
  );
}
