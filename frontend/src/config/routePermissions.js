export const ROUTE_PERMISSIONS = {
  "/dashboard": "Dashboard",
  "/powerbi": "Power BI",
  "/ventas-completas": "Ventas Completas",
  "/usuarios": "Usuarios",
  "/agencias": "Agencias",
  "/usuarios-agencias": "Usuarios Agencias",
  "/revision-gestiones": "Revision Gestiones",
  "/revision-gestiones-comercial": "Revision Gestiones Comercial",
  "/bdd-ventas": "Base de Datos Ventas",
  "/bonos": "Bonos",
  "/tasks": "Tareas",
  "/metas-comerciales": "Metas Comerciales",
  "/reporte-entregas": "Reporte Entregas",
  "/entregas-pendientes": "Entregas Pendientes",
  "/entregas-repartidores-tabla": "Informe Entregas",
  "/revisar-cajas": "Cierres de Caja",
  "/revisar-cajas2": "Cierres de Caja Detalle",
  "/entregas-auditoria": "Entregas Auditoria",
  "/ventas-auditoria": "Ventas Auditoria",
  "/copa-creditek": "Copa Creditek",
  "/goleadores": "Goleadores",
  "/postulaciones": "Postulaciones",
  "/rol": "Roles",
  "/dispositivos": "Dispositivos",
  "/marcas": "Marcas",
  "/modelos": "Modelos",
  "/dispositivosMarcas": "Dispositivos Marcas",
  "/costoHistorico": "Costo Historico",
  "/formas-pago": "Formas de Pago",
  "/origen": "Origen",
  "/obsequios": "Obsequios",
  "/estado-entrega": "Estado Entrega",
  "/permisos": "Permisos",
  "/asignar-permisos": "Asignar Permisos",
  "/asignar-permisos-usuario-agencia": "Asignar Permisos Usuario Agencia",
  "/usuarios-permisos": "Usuarios con Permisos",
  "/logistica-panel": "Logistica",
  "/vendedor-panel": "Ventas",
  "/mis-ventas": "Mis Ventas",
  "/registrar-clientes-venta": "Crear Venta",
  "/crear-venta": "Crear Venta",
  "/ventacompleta": "Crear Venta Completa",
  "/crear-entrega-completa": "Crear Entrega Completa",
  "/crear-gestion-comercial": "Gestion Comercial",
  "/mis-entregas": "Mis Entregas",
  "/mis-entregas-pendientes": "Mis Entregas Pendientes",
  "/mis-entregas-realizadas": "Mis Entregas Realizadas",
  "/crear-traslado": "Crear Traslado",
  "/mis-traslados": "Mis Traslados",
  "/gestion": "Gestion",
  "/mis-gestiones": "Mis Gestiones",
  "/mis-gestiones-comerciales": "Mis Gestiones Comerciales",
  "/caja": "Caja",
};

export const SYSTEM_ROUTES = Object.entries(ROUTE_PERMISSIONS).map(
  ([path, permission]) => ({
    path,
    permission,
    descripcion: `Acceso a ${path}`,
  }),
);

export const ADMIN_PERMISSION_PATHS = [
  "/recuperar-permisos",
  "/permisos",
  "/asignar-permisos",
  "/asignar-permisos-usuario-agencia",
  "/usuarios-permisos",
];

export const ROUTE_REDIRECT_ORDER = [
  "/dashboard",
  "/powerbi",
  "/metas-comerciales",
  "/reporte-entregas",
  "/entregas-pendientes",
  "/ventas-auditoria",
  "/mis-ventas",
  "/vendedor-panel",
  "/logistica-panel",
];

export const normalizeRole = (rol) => String(rol || "").trim().toLowerCase();

const normalizePermissionName = (permiso) =>
  String(permiso || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const normalizePermissions = (permisos = []) =>
  Array.isArray(permisos)
    ? permisos.map((permiso) => String(permiso).trim()).filter(Boolean)
    : [];

export const hasRouteAccess = ({ permisos = [], path, permission }) => {
  if (ADMIN_PERMISSION_PATHS.includes(path)) {
    return true;
  }

  const permisoRequerido = permission || ROUTE_PERMISSIONS[path];
  if (!permisoRequerido) return true;

  const permisosNormalizados = normalizePermissions(permisos).map(normalizePermissionName);
  return permisosNormalizados.includes(normalizePermissionName(permisoRequerido));
};
