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
CostoHistorico.belongsTo(formaPago, { foreignKey: "formaPagoId", as: "formaPago" });
formaPago.hasMany(CostoHistorico, { foreignKey: "formaPagoId", as: "costosHistoricos" });

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

Traslado.hasMany(DetalleTraslado, { foreignKey: "trasladoId" });
DetalleTraslado.belongsTo(Traslado, { foreignKey: "trasladoId" });
