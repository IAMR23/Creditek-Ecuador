// associations.js
const Usuario = require('./Usuario');
const Rol = require('./Rol');
const Agencia = require('./Agencia');
const UsuarioAgencia = require('./UsuarioAgencia');

const Venta = require('./Venta');
const DetalleVenta = require('./DetalleVenta');
const VentaObsequio = require('./VentaObsequio');
const Cliente = require('./Cliente');
const Origen = require('./Origen');

const Entrega = require('./Entrega');
const EntregaObsequio = require('./EntregaObsequio');
const Obsequio = require('./Obsequio');

const Dispositivo = require('./Dispositivo');
const CostoHistorico = require('./CostoHistorico');
const Marca = require('./Marca');
const Modelo = require('./Modelo');
const DispositivoMarca = require('./DispositivoMarca');
const formaPago = require('./FormaPago');
const DetalleEntrega = require('./DetalleEntrega');
const UsuarioAgenciaEntrega = require('./UsuarioAgenciaEntrega');
const Traslado = require('./Traslado');
const DetalleTraslado = require('./DetalleTraslado');
const Gestion = require('./Gestion');
const CierreCaja = require('./CierreCaja/CierreCaja');
const MovimientoCaja = require('./CierreCaja/MovimientoCaja');
const Denominacion = require('./CierreCaja/Denominacion');
const RetiroCaja = require('./CierreCaja/RetiroCaja');
const ReaperturaCierreCaja = require('./CierreCaja/ReaperturaCierreCaja');
const Task = require('./Task');
const SistemaTarea = require('./SistemaTarea');
const PlanBatalla = require('./PlanBatalla');
const SecretarioEjecutivoPlan = require('./SecretarioEjecutivoPlan');
const NominaEmpleado = require('./NominaEmpleado');
const { NominaBeneficio } = require('./NominaBeneficio');
const GestionComercial = require('./GestionComercial');
const PrecioVenta = require('./PrecioVenta');
const PresupuestoMarketing = require('./Marketing/PresupuestoMarketing');
const GastoMarketing = require('./Marketing/GastoMarketing');
const ConciliacionLote = require('./ConciliacionLote');
const ConciliacionPdfImportacion = require('./ConciliacionPdfImportacion');
const ConciliacionModeloTv = require('./ConciliacionModeloTv');
const ConciliacionModeloCelular = require('./ConciliacionModeloCelular');
const MapaComercialZona = require('./MapaComercialZona');
const MapaUbicacionNormalizada = require('./MapaUbicacionNormalizada');
require('./UsuarioPermiso');
require('./UsuarioRol');
// -------------------- Usuario, Rol, Agencia --------------------
Usuario.belongsTo(Rol, { foreignKey: 'rolId', as: 'rol' });
Rol.hasMany(Usuario, { foreignKey: 'rolId', as: 'usuarios' });

// Agencia ↔ Usuario (muchos a muchos)
Usuario.belongsToMany(Agencia, {
  through: UsuarioAgencia, 
  foreignKey: "usuarioId",
  as: "agencias",
});

Agencia.belongsToMany(Usuario, {
  through: UsuarioAgencia,
  foreignKey: "agenciaId",
  as: "usuarios",
});

// Relaciones directas para include desde UsuarioAgencia
UsuarioAgencia.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
UsuarioAgencia.belongsTo(Agencia, { foreignKey: "agenciaId", as: "agencia" });

// -------------------- Dispositivos, Marcas, Modelos --------------------

// Dispositivo ↔ Marca (muchos a muchos)
Dispositivo.belongsToMany(Marca, {
  through: DispositivoMarca,
  foreignKey: "dispositivoId",
  as: "marcasDispositivo",
});

Marca.belongsToMany(Dispositivo, {
  through: DispositivoMarca,
  foreignKey: "marcaId",
  as: "dispositivosMarca",
});

// Marca ↔ Modelo (uno a muchos)
Marca.hasMany(Modelo, { foreignKey: "marcaId", as: "modelos" });
Modelo.belongsTo(Marca, { foreignKey: "marcaId", as: "marca" });

DispositivoMarca.belongsTo(Dispositivo, { foreignKey: "dispositivoId", as: "dispositivo" });
Dispositivo.hasMany(DispositivoMarca, { foreignKey: "dispositivoId", as: "dispositivosMarcas" });
DispositivoMarca.belongsTo(Marca, { foreignKey: "marcaId", as: "marca" });
Marca.hasMany(DispositivoMarca, { foreignKey: "marcaId", as: "marcasDispositivos" });

CostoHistorico.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(CostoHistorico, { foreignKey: "modeloId", as: "costosHistoricos" });

PrecioVenta.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(PrecioVenta, { foreignKey: "modeloId", as: "preciosVenta" });

// -------------------- Venta --------------------
Venta.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Cliente.hasMany(Venta, { foreignKey: 'clienteId', as: 'ventas' });

Venta.belongsTo(Origen, { foreignKey: 'origenId', as: 'origen' });
Origen.hasMany(Venta, { foreignKey: 'origenId', as: 'ventas' });

Venta.hasMany(DetalleVenta, { foreignKey: 'ventaId', as: 'detalleVenta' });
DetalleVenta.belongsTo(Venta, { foreignKey: 'ventaId', as: 'venta' });

DetalleVenta.belongsTo(DispositivoMarca, { 
  foreignKey: "dispositivoMarcaId", 
  as: "dispositivoMarca" 
});

DispositivoMarca.hasMany(DetalleVenta, { 
  foreignKey: "dispositivoMarcaId", 
  as: "detallesVenta" 
});

// Relación DetalleVenta ↔ Modelo
DetalleVenta.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(DetalleVenta, { foreignKey: "modeloId", as: "detalleVentas" });

Modelo.belongsTo(DispositivoMarca, {
  foreignKey: "dispositivoMarcaId",
  as: "dispositivoMarca"
});
DispositivoMarca.hasMany(Modelo, {
  foreignKey: "dispositivoMarcaId",
  as: "modelos"
});


VentaObsequio.belongsTo(Venta, { foreignKey: "ventaId", as: "venta" });
Venta.hasMany(VentaObsequio, { foreignKey: "ventaId" , as: "obsequiosVenta" });


VentaObsequio.belongsTo(Obsequio, { foreignKey: "obsequioId", as: "obsequio" });
Obsequio.hasMany(VentaObsequio, { foreignKey: "obsequioId", as: "ventasObsequio" });

 
// DetalleVenta ↔ FormaPago
DetalleVenta.belongsTo(formaPago, {
  foreignKey: "formaPagoId",
  as: "formaPago"
});

formaPago.hasMany(DetalleVenta, {
  foreignKey: "formaPagoId",
  as: "detalleVentas"
});


// -------------------- Entrega --------------------
Entrega.belongsTo(Venta, { foreignKey: 'ventaId', as: 'venta' });
Venta.hasMany(Entrega, { foreignKey: 'ventaId', as: 'entregas' });


 

Entrega.hasMany(EntregaObsequio, { foreignKey: 'entregaId', as: 'obsequiosEntrega' });
EntregaObsequio.belongsTo(Entrega, { foreignKey: 'entregaId', as: 'entrega' });

// -------------------- Obsequio --------------------

EntregaObsequio.belongsTo(Obsequio, { foreignKey: 'obsequioId', as: 'obsequio' });
Obsequio.hasMany(EntregaObsequio, { foreignKey: 'obsequioId', as: 'entregas' });

Entrega.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Cliente.hasMany(Entrega, { foreignKey: 'clienteId', as: 'entregas' });

Entrega.belongsTo(Origen, { foreignKey: 'origenId', as: 'origen' });
Origen.hasMany(Entrega, { foreignKey: 'origenId', as: 'entregas' });

// DetalleEntrega ↔ Entrega
DetalleEntrega.belongsTo(Entrega, { foreignKey: 'entregaId', as: 'entregaDetalle' });
Entrega.hasMany(DetalleEntrega, { foreignKey: 'entregaId', as: 'detalleEntregas' });


DetalleEntrega.belongsTo(DispositivoMarca, { 
  foreignKey: "dispositivoMarcaId", 
  as: "dispositivoMarca" 
});
DispositivoMarca.hasMany(DetalleEntrega, { 
  foreignKey: "dispositivoMarcaId", 
  as: "detalleEntregas" 
});


/* ESTADO ENTREGAS */

DetalleEntrega.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(DetalleEntrega, { foreignKey: "modeloId", as: "detalleEntregas" });

DetalleEntrega.belongsTo(formaPago, {
  foreignKey: "formaPagoId",
  as: "formaPago"
});

formaPago.hasMany(DetalleEntrega, {
  foreignKey: "formaPagoId",
  as: "detalleEntregas"
});

/* USUARIO AGNCIAS ENTREGAS ENTREGAS */

UsuarioAgencia.belongsToMany(Entrega, {
  through: UsuarioAgenciaEntrega,
  foreignKey: "usuario_agencia_id",
  otherKey: "entrega_id",
  as: "entregas",
});

Entrega.belongsToMany(UsuarioAgencia, {
  through: UsuarioAgenciaEntrega,
  foreignKey: "entrega_id",
  otherKey: "usuario_agencia_id",
  as: "repartidores",
});


// UsuarioAgenciaEntrega → UsuarioAgencia
UsuarioAgenciaEntrega.belongsTo(UsuarioAgencia, {
  foreignKey: "usuario_agencia_id",
  as: "usuarioAgencia",
});

// UsuarioAgenciaEntrega → Entrega
UsuarioAgenciaEntrega.belongsTo(Entrega, {
  foreignKey: "entrega_id",
  as: "entrega",
});


//traslados 
// Traslado - Detalle
Traslado.hasMany(DetalleTraslado, {
  foreignKey: "trasladoId",
  as: "detalles",
});

DetalleTraslado.belongsTo(Traslado, {
  foreignKey: "trasladoId",
});

// Traslado - Agencia
Traslado.belongsTo(Agencia, {
  foreignKey: "agencia_origen_id",
  as: "agenciaOrigen",
});

Traslado.belongsTo(Agencia, {
  foreignKey: "agencia_destino_id",
  as: "agenciaDestino",
});



// DetalleTraslado relaciones faltantes (IMPORTANTE)
DetalleTraslado.belongsTo(DispositivoMarca, {
  foreignKey: "dispositivoMarcaId",
  as: "dispositivoMarca",
});

DetalleTraslado.belongsTo(Modelo, {
  foreignKey: "modeloId",
  as: "modelo",
});


/* GESTIONES */

Gestion.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

Gestion.belongsTo(Dispositivo, {
  foreignKey: "dispositivoId",
  as: "dispositivo",
});

UsuarioAgencia.hasMany(Gestion, {
  foreignKey: "usuarioAgenciaId",
  as: "gestiones",
});

Dispositivo.hasMany(Gestion, {
  foreignKey: "dispositivoId",
  as: "gestiones",
});

/* CIERRE DE CAJA */

CierreCaja.hasMany(Denominacion, {
  foreignKey: "cierreId",
  as: "denominaciones",
});

Denominacion.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});


CierreCaja.hasMany(MovimientoCaja, {
  foreignKey: "cierreId",
  as: "movimientos",
});

MovimientoCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});


CierreCaja.hasMany(RetiroCaja, {
  foreignKey: "cierreId",
  as: "retiros",
});

RetiroCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});


CierreCaja.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

UsuarioAgencia.hasMany(CierreCaja, {
  foreignKey: "usuarioAgenciaId",
  as: "cierresCaja",
});

CierreCaja.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Usuario.hasMany(CierreCaja, {
  foreignKey: "usuarioId",
  as: "cierresCajaUsuario",
});

CierreCaja.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(CierreCaja, {
  foreignKey: "agenciaId",
  as: "cierresCajaAgencia",
});

CierreCaja.hasMany(ReaperturaCierreCaja, {
  foreignKey: "cierreId",
  as: "reaperturas",
});

ReaperturaCierreCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});

ReaperturaCierreCaja.belongsTo(Usuario, {
  foreignKey: "reabiertoPorUsuarioId",
  as: "reabiertoPor",
});

ReaperturaCierreCaja.belongsTo(Usuario, {
  foreignKey: "recerradoPorUsuarioId",
  as: "recerradoPor",
});


/* GESTOR DE TAREAS */
Usuario.hasMany(Task, { foreignKey: "createdBy", as: "createdTasks" });
Usuario.hasMany(Task, { foreignKey: "assignedTo", as: "assignedTasks" });

Task.belongsTo(Usuario, { foreignKey: "createdBy", as: "creator" });
Task.belongsTo(Usuario, { foreignKey: "assignedTo", as: "assignee" });

Usuario.hasMany(SistemaTarea, {
  foreignKey: "creadoPorId",
  as: "sistemaTareasCreadas",
});
SistemaTarea.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});

UsuarioAgencia.hasMany(PlanBatalla, {
  foreignKey: "usuarioAgenciaId",
  as: "planesBatalla",
});

PlanBatalla.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

Usuario.hasMany(SecretarioEjecutivoPlan, {
  foreignKey: "usuarioId",
  as: "planesSecretarioEjecutivo",
});

SecretarioEjecutivoPlan.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Agencia.hasMany(SecretarioEjecutivoPlan, {
  foreignKey: "agenciaId",
  as: "planesSecretarioEjecutivo",
});

SecretarioEjecutivoPlan.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

/* NOMINA */
Usuario.hasMany(NominaEmpleado, {
  foreignKey: "usuarioId",
  as: "nominaEmpleados",
});

NominaEmpleado.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

UsuarioAgencia.hasOne(NominaEmpleado, {
  foreignKey: "usuarioAgenciaId",
  as: "nominaEmpleado",
});

NominaEmpleado.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

NominaEmpleado.hasMany(NominaBeneficio, {
  foreignKey: "nominaEmpleadoId",
  as: "beneficios",
});

NominaBeneficio.belongsTo(NominaEmpleado, {
  foreignKey: "nominaEmpleadoId",
  as: "nominaEmpleado",
});

/* GESTIONES COMERCIALES */

// UsuarioAgencia -> GestionComercial
UsuarioAgencia.hasMany(GestionComercial, {
  foreignKey: "usuarioAgenciaId",
  as: "gestionesComerciales",
});

GestionComercial.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

// Dispositivo -> GestionComercial
Dispositivo.hasMany(GestionComercial, {
  foreignKey: "dispositivoId",
  as: "gestionesComerciales",
});

GestionComercial.belongsTo(Dispositivo, {
  foreignKey: "dispositivoId",
  as: "dispositivo",
});

/* MARKETING */

PresupuestoMarketing.belongsTo(Agencia, {
  foreignKey: "departamentoId",
  as: "departamento",
});

Agencia.hasMany(PresupuestoMarketing, {
  foreignKey: "departamentoId",
  as: "presupuestosMarketing",
});

GastoMarketing.belongsTo(Agencia, {
  foreignKey: "departamentoId",
  as: "departamento",
});

Agencia.hasMany(GastoMarketing, {
  foreignKey: "departamentoId",
  as: "gastosMarketing",
});

/* CONCILIACION PDF */

ConciliacionLote.hasMany(ConciliacionPdfImportacion, {
  foreignKey: "loteImportacionId",
  as: "importaciones",
});

ConciliacionPdfImportacion.belongsTo(ConciliacionLote, {
  foreignKey: "loteImportacionId",
  as: "lote",
});

Usuario.hasMany(ConciliacionLote, {
  foreignKey: "usuarioId",
  as: "conciliacionLotes",
});

ConciliacionLote.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

ConciliacionModeloTv.belongsTo(Modelo, {
  foreignKey: "modeloRveId",
  as: "modeloRve",
});

Modelo.hasMany(ConciliacionModeloTv, {
  foreignKey: "modeloRveId",
  as: "mapeosConciliacionTv",
});

ConciliacionModeloCelular.belongsTo(Modelo, {
  foreignKey: "modeloRveId",
  as: "modeloRve",
});

Modelo.hasMany(ConciliacionModeloCelular, {
  foreignKey: "modeloRveId",
  as: "mapeosConciliacionCelular",
});

/* MAPA COMERCIAL */

MapaComercialZona.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(MapaComercialZona, {
  foreignKey: "agenciaId",
  as: "mapaComercialZonas",
});

MapaUbicacionNormalizada.belongsTo(MapaComercialZona, {
  foreignKey: "zonaId",
  as: "zona",
});
