import { useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import Swal from "sweetalert2";
import { api } from "../../api/client";
import { getPersonalData } from "../../utils/interviews";

const EMPTY_FORM = {
  nombre: "",
  cedula: "",
  email: "",
  usuario: "",
  password: "",
  rolId: "",
  fechaIngreso: "",
  fechaSalida: "",
  numeroCuenta: "",
  direccion: "",
  telefono: "",
  agenciaId: "",
};

const normalizeOptionalText = (value) =>
  value?.trim() ? value.trim() : null;

const buildUsernameFromEmail = (email) => {
  const localPart = String(email || "").split("@")[0].toLowerCase();
  const normalized = localPart
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 50);

  return normalized.length >= 3 ? normalized : "";
};

const buildFormFromCandidate = (candidate) => {
  const datos = getPersonalData(candidate);
  const email =
    datos.email ||
    datos.correo ||
    datos.correoElectronico ||
    "";

  return {
    ...EMPTY_FORM,
    nombre: datos.nombreCompleto || candidate?.nombre || "",
    cedula: datos.cedula || candidate?.cedula || "",
    email,
    usuario: buildUsernameFromEmail(email),
    telefono: datos.telefono || candidate?.telefono || "",
    direccion: datos.direccion || "",
  };
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100";

export default function CreateUserModal({
  open,
  candidate,
  roles,
  agencies,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && candidate) {
      setForm(buildFormFromCandidate(candidate));
    }
  }, [candidate, open]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [loading, onClose, open]);

  if (!open || !candidate) return null;

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.rolId) {
      await Swal.fire({
        icon: "warning",
        title: "Rol requerido",
        text: "Selecciona un rol.",
        confirmButtonColor: "#f97316",
      });
      return;
    }

    if (!form.agenciaId) {
      await Swal.fire({
        icon: "warning",
        title: "Agencia requerida",
        text: "Selecciona una agencia para el usuario.",
        confirmButtonColor: "#f97316",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await api.post("/usuarios", {
        nombre: form.nombre,
        cedula: form.cedula,
        email: form.email,
        usuario: form.usuario || undefined,
        password: form.password,
        rolId: form.rolId,
        fechaIngreso: form.fechaIngreso || null,
        fechaSalida: form.fechaSalida || null,
        numeroCuenta: normalizeOptionalText(form.numeroCuenta),
        direccion: normalizeOptionalText(form.direccion),
        telefono: normalizeOptionalText(form.telefono),
        agenciaId: form.agenciaId,
      });

      await Swal.fire({
        icon: "success",
        title: "Usuario creado",
        text: "El usuario y su agencia fueron registrados correctamente.",
        timer: 1600,
        showConfirmButton: false,
      });
      onCreated(response.data);
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "No se pudo crear el usuario",
        text:
          error.response?.data?.message ||
          "Ocurrió un error al crear el usuario.",
        confirmButtonColor: "#f97316",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
              Entrevistas
            </p>
            <h2
              id="create-user-title"
              className="mt-1 text-xl font-extrabold text-slate-950"
            >
              Crear usuario
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Los datos disponibles fueron precargados desde la postulación.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Cerrar creación de usuario"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={submit} className="overflow-y-auto px-5 py-5">
          <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Revisa los datos precargados y completa usuario, email, contraseña,
            rol y agencia antes de guardar.
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Nombre
              <input
                type="text"
                required
                autoFocus
                value={form.nombre}
                onChange={updateField("nombre")}
                className={`${fieldClass} mt-1`}
                placeholder="Nombre completo"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Cédula
              <input
                type="text"
                required
                value={form.cedula}
                onChange={updateField("cedula")}
                className={`${fieldClass} mt-1`}
                placeholder="Número de cédula"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                required
                value={form.email}
                onChange={updateField("email")}
                onBlur={() =>
                  setForm((current) => ({
                    ...current,
                    usuario:
                      current.usuario ||
                      buildUsernameFromEmail(current.email),
                  }))
                }
                className={`${fieldClass} mt-1`}
                placeholder="correo@ejemplo.com"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Usuario
              <input
                type="text"
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9._-]{3,50}"
                title="Usa entre 3 y 50 letras, números, puntos, guiones o guiones bajos."
                autoComplete="username"
                value={form.usuario}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    usuario: event.target.value.toLowerCase(),
                  }))
                }
                className={`${fieldClass} mt-1`}
                placeholder="Ej. maria.perez"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Contraseña
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={updateField("password")}
                className={`${fieldClass} mt-1`}
                placeholder="Mínimo 6 caracteres"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Rol
              <select
                required
                value={form.rolId}
                onChange={updateField("rolId")}
                className={`${fieldClass} mt-1`}
              >
                <option value="">Seleccione un rol</option>
                {roles
                  .filter((role) => role.activo !== false)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nombre}
                    </option>
                  ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Teléfono
              <input
                type="text"
                value={form.telefono}
                onChange={updateField("telefono")}
                className={`${fieldClass} mt-1`}
                placeholder="Teléfono"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Número de cuenta
              <input
                type="text"
                value={form.numeroCuenta}
                onChange={updateField("numeroCuenta")}
                className={`${fieldClass} mt-1`}
                placeholder="Número de cuenta"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Fecha de ingreso
              <input
                type="date"
                value={form.fechaIngreso}
                onChange={updateField("fechaIngreso")}
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Fecha de salida
              <input
                type="date"
                value={form.fechaSalida}
                onChange={updateField("fechaSalida")}
                className={`${fieldClass} mt-1`}
              />
            </label>

            <label className="text-sm font-semibold text-slate-700 md:col-span-2">
              Dirección
              <textarea
                value={form.direccion}
                onChange={updateField("direccion")}
                className={`${fieldClass} mt-1 min-h-20 resize-y`}
                placeholder="Dirección"
              />
            </label>

            <fieldset className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
              <legend className="px-1 text-sm font-extrabold text-slate-950">
                Agencia
              </legend>
              <p className="mb-3 text-xs text-slate-500">
                Selecciona una agencia para activar al usuario.
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {agencies.map((agency) => (
                  <label
                    key={agency.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                      String(form.agenciaId) === String(agency.id)
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="agencia-crear-usuario-entrevista"
                      value={agency.id}
                      checked={
                        String(form.agenciaId) === String(agency.id)
                      }
                      onChange={updateField("agenciaId")}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        {agency.nombre}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {agency.ciudad || "-"}
                      </span>
                    </span>
                  </label>
                ))}
                {!agencies.length && (
                  <p className="text-sm text-red-600">
                    No hay agencias activas disponibles.
                  </p>
                )}
              </div>
            </fieldset>
          </div>

          <footer className="sticky bottom-0 mt-5 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !agencies.length}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={17} />
              {loading ? "Creando..." : "Crear usuario"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
