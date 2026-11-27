import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ImageUp, ReceiptText, RefreshCw, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import Swal from "sweetalert2";
import { api } from "../../api/client";

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 600 * 1024;
const TIPOS_DOCUMENTO = ["Factura", "Nota de Venta", "Otros"];

const mensajeError = (error) =>
  error.response?.data?.message || error.message || "No se pudo cargar la foto.";

export default function SubirFactura() {
  const [foto, setFoto] = useState(null);
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef(null);
  const camaraRef = useRef(null);
  const preview = useMemo(() => (foto ? URL.createObjectURL(foto) : ""), [foto]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const seleccionarFoto = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      await Swal.fire("Formato no valido", "Selecciona una imagen JPG, PNG o WEBP.", "info");
      return;
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      await Swal.fire("Imagen muy grande", "La imagen original no puede superar los 10 MB.", "info");
      return;
    }
    setFoto(file);
  };

  const subir = async () => {
    if (!tipoDocumento) {
      await Swal.fire(
        "Selecciona el tipo de documento",
        "Indica si la foto corresponde a una factura, nota de venta u otro documento.",
        "warning",
      );
      return;
    }
    if (!foto || subiendo) return;
    setSubiendo(true);
    try {
      const processed = await imageCompression(foto, {
        maxSizeMB: 0.55,
        useWebWorker: true,
        initialQuality: 0.9,
        fileType: "image/webp",
        alwaysKeepResolution: true,
      });
      if (processed.size > MAX_PROCESSED_IMAGE_BYTES) {
        throw new Error("No se pudo reducir la imagen por debajo de 600 KB.");
      }

      const formData = new FormData();
      formData.append(
        "foto",
        new File([processed], `factura-${Date.now()}.webp`, { type: "image/webp" }),
      );
      formData.append("tipo", tipoDocumento);
      const { data } = await api.post("/api/repartidor/facturas", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFoto(null);
      setTipoDocumento("");
      await Swal.fire({
        title: "Factura enviada",
        text: `${data.message} La fecha y hora se registraron automaticamente.`,
        icon: "success",
      });
    } catch (error) {
      await Swal.fire("No se pudo enviar la factura", mensajeError(error), "error");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-green-100 p-3 text-green-700"><ReceiptText size={26} /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Subir foto de factura</h1>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Toma una foto o selecciona una imagen. El sistema registrara automaticamente tu usuario, fecha y hora de carga.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <label htmlFor="tipo-documento" className="mb-2 block text-sm font-bold text-slate-800">
              Tipo de documento <span className="text-red-600">*</span>
            </label>
            <select
              id="tipo-documento"
              value={tipoDocumento}
              disabled={subiendo}
              onChange={(event) => setTipoDocumento(event.target.value)}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100 disabled:bg-slate-100"
              required
            >
              <option value="">Selecciona una opción</option>
              {TIPOS_DOCUMENTO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">Este campo es obligatorio para guardar la foto.</p>
          </div>
          {!preview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => camaraRef.current?.click()} className="flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-green-300 bg-green-50 p-5 text-green-800 hover:bg-green-100">
                <Camera size={42} />
                <span className="mt-3 font-bold">Tomar foto</span>
                <span className="mt-1 text-xs">Usa la camara del dispositivo</span>
              </button>
              <button type="button" onClick={() => archivoRef.current?.click()} className="flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-5 text-sky-800 hover:bg-sky-100">
                <ImageUp size={42} />
                <span className="mt-3 font-bold">Subir imagen</span>
                <span className="mt-1 text-xs">JPG, PNG o WEBP, maximo 10 MB</span>
              </button>
              <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => seleccionarFoto(event.target.files?.[0])} />
              <input ref={archivoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => seleccionarFoto(event.target.files?.[0])} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-slate-100">
                <img src={preview} alt="Vista previa de la factura" className="max-h-[58vh] w-full object-contain" />
                <button type="button" disabled={subiendo} onClick={() => setFoto(null)} aria-label="Quitar foto" className="absolute right-3 top-3 rounded-full bg-slate-950/70 p-2 text-white hover:bg-slate-950 disabled:opacity-50"><X size={18} /></button>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 size={18} /> Foto lista para enviar
              </div>
              <button type="button" disabled={subiendo || !tipoDocumento} onClick={subir} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60">
                {subiendo ? <RefreshCw size={19} className="animate-spin" /> : <ImageUp size={19} />}
                {subiendo ? "Optimizando y enviando..." : tipoDocumento ? "Guardar foto" : "Selecciona el tipo para guardar"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
