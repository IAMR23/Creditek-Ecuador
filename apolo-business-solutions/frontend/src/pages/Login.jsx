import { useContext, useState } from "react";
import Swal from "sweetalert2";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const auth = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await auth.login(form);
      Swal.fire({
        icon: "success",
        title: "Bienvenido",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "No se pudo iniciar sesión",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/80 backdrop-blur border border-slate-200 rounded-2xl shadow-xl p-6">
        <div className="flex items-baseline gap-3">
          <div className="text-3xl font-extrabold tracking-tight">
            <span className="text-black">A</span>
            <span className="text-orange-500">B</span>
            <span className="text-black">S</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
        </div>
        <div className="mt-3">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
            Iniciar sesión
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Accede al panel de administración.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <input
            type="email"
            placeholder="Email"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="border border-slate-200 bg-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-200"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-slate-950 hover:bg-slate-900 disabled:bg-slate-700 text-white p-3 rounded-xl font-semibold"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

