# Kilometraje y gasto de combustible — RVE

Proyecto activo: `backend/` y `frontend/`.

## Pantallas y permisos

| Usuario | Acceso | Operaciones |
| --- | --- | --- |
| Repartidor | Tarjeta «Kilometraje y combustible» en `/logistica-panel`, pantalla `/logistica-panel/combustible` | Crear, consultar, editar y eliminar exclusivamente sus registros |
| Admin / administrador | Logística → «Gasto combustible», `/logistica/gasto-combustible` | Consultar todos, filtrar, ver totales/gráficas y eliminar |

El panel del repartidor tiene dos pestañas: **Ingreso del gasto** (abierta
inicialmente, con el formulario) y **Mis gastos realizados** (todos sus registros,
filtros, totales, edición y eliminación). Guardar lleva al historial; editar
abre el gasto en la primera pestaña. No permite ver gastos de otros repartidores.

El administrador necesita el permiso explícito `Logistica` o `Administracion`,
siguiendo la política existente de RVE. El rol repartidor mantiene el acceso
implícito a su panel. Un permiso administrativo asignado a un repartidor no le
permite consultar datos de otros usuarios ni abrir el dashboard administrativo.
Los demás roles no acceden a esta funcionalidad.

La autenticación usa `authenticate`; las consultas administrativas usan
`requireAdminRole` y `requirePermission`. El servicio repite las comprobaciones
de acceso y propiedad. `userId` se toma del usuario autenticado al crear;
no se permite reasignarlo al editar. Los registros ajenos responden 404.

El gasto se registra en **USD**, las distancias en **km**, y es obligatorio
seleccionar el **vehículo utilizado** de este catálogo cerrado:
`MOTO ROJA`, `FURGONETA`, `CARRO HAVAL` o `MOTO AZUL`.
No se solicita el volumen de combustible consumido. Los importes admiten dos decimales. La distancia se calcula
en backend y se muestra automáticamente en frontend. Se rechaza el odómetro
decreciente, la fecha inválida, valores negativos/no numéricos, observaciones
mayores a 2000 caracteres y vehículos fuera del catálogo. Se admiten
recorridos y gastos cero. No se impone continuidad entre registros porque
el vehículo se selecciona por registro y puede cambiar entre recorridos.

La eliminación es lógica (`deletedAt`): retira el registro de listados,
totales y gráficas y conserva la fila histórica. La interfaz confirma antes
de eliminar. La restauración no forma parte de este módulo.

## API

Base: `/api/logistica/combustible`.

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| GET | `/` | Lista paginada, totales y series del alcance autorizado |
| GET | `/:id` | Detalle del registro autorizado |
| POST | `/` | Creación por repartidor |
| PUT | `/:id` | Edición completa por el repartidor propietario |
| DELETE | `/:id` | Baja lógica por propietario o administrador autorizado |
| GET | `/repartidores` | Catálogo administrativo de id/nombre, incluyendo propietarios históricos |

Filtros de GET: `desde`, `hasta` (AAAA-MM-DD), `userId`, `kmMin`, `kmMax`,
`pagina` (inicial 1), `limite` (inicial 20, máximo 100). El rango de kilometraje
filtra **kilómetros recorridos por registro**. Desde/hasta son inclusivos.
Los totales y las series incluyen todas las páginas del filtro; las consultas
comparten una transacción de lectura `REPEATABLE READ`.

Ejemplo de cuerpo POST/PUT:

```json
{
  "fecha": "2026-10-06",
  "vehiculo": "MOTO ROJA",
  "kilometrajeInicial": 15000.1,
  "kilometrajeFinal": 15120.3,
  "costoCombustible": 24.5,
  "observacion": "Recorrido de entregas"
}
```

GET devuelve `registros`, `paginacion`, `totales`, `porFecha` y `porRepartidor`.
Los totales incluyen kilómetros y gasto, sin consumo en litros.
Los listados y detalles incluyen `vehiculo` y omiten el consumo histórico.
Los DECIMAL de registros se serializan como cadenas
por Sequelize; el frontend los convierte para formatearlos. Las series y
los totales se devuelven como números. El dashboard usa Recharts y muestra
gasto por fecha, kilómetros por fecha y comparación de hasta seis repartidores
con mayor gasto, con un aviso cuando existen más.

## Migración y ejecución

Migraciones:

- `migrations/202610060001-create-logistica-combustible.sql`: creación inicial.
- `migrations/202610060002-combustible-vehiculo-sin-consumo.sql`: actualización compatible.
- `migrations/202610060003-combustible-catalogo-vehiculos.sql`: catálogo cerrado de vehículos.

La migración inicial
Crea `logistica_combustible_registros` con nombres camelCase como los modelos
de RVE: `userId`, `kilometrajeInicial`, `kilometrajeFinal`,
`kilometrosRecorridos`, `combustibleConsumido`, `costoCombustible`,
`createdAt`, `updatedAt`, además de `id`, `fecha`, `observacion`, `deletedAt`.
Incluye FK a `usuarios` con `ON DELETE RESTRICT`, índices por usuario/fecha
y fecha, y CHECK de consistencia. Usa una transacción y operaciones idempotentes,
sin borrar filas ni modificar tablas existentes de entregas. Incluye
verificaciones SQL previas y finales. También agrega el CHECK si Sequelize
había creado la tabla. La segunda añade `vehiculo`, hace nullable
`combustibleConsumido` y actualiza el CHECK para permitir gastos sin litros.
La tercera restringe nuevas inserciones y actualizaciones a los cuatro vehículos.
Conserva los valores históricos de consumo; no asigna cero ni inventa vehículos.
Los vehículos históricos desconocidos se muestran como «No registrado»;
para editar esos gastos, el repartidor debe completar el vehículo.
`connectDB()` y `migrate:logistica-combustible` aplican ambas migraciones en orden.

Desde la raíz del repositorio, en PowerShell, con los `.env` existentes
configurados para el entorno correspondiente:

```powershell
cd backend
npm ci
npm run migrate:logistica-combustible
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Producción: `npm start` en backend y `npm run build` en frontend.
La migración manual permite verificar el esquema antes del primer arranque.
No se aplicó la migración a la base configurada en `.env` durante el desarrollo;
se validó en un PostgreSQL 17 temporal aislado. El CHECK fallará si una tabla
preexistente contiene datos inconsistentes; hay que corregirlos antes de
reintentar, conservando el respaldo de los registros afectados.

## Verificación

1. Entrar como repartidor y abrir la tarjeta en `logistica-panel`.
2. En «Ingreso del gasto», comprobar que el selector contenga únicamente
   `MOTO ROJA`, `FURGONETA`, `CARRO HAVAL` y `MOTO AZUL`. Registrar `MOTO ROJA`,
   odómetro 100 → 130 y USD 5. Verificar 30 km, sin solicitar litros,
   y que al guardar aparezca en «Mis gastos realizados».
3. Editarlo a odómetro final 140. Verificar 40 km y actualización de totales.
4. Probar fecha vacía/inválida, final menor al inicial, números negativos y
   vehículo vacío o fuera del catálogo: deben rechazarse. Un gasto positivo
   sin datos de consumo debe aceptarse.
5. Entrar como otro repartidor: no debe aparecer el registro del primero.
   Las consultas/ediciones/eliminaciones de un id ajeno deben devolver 404;
   filtrar o crear con otro `userId` debe devolver 403.
6. Entrar como administrador con `Logistica` o `Administracion` y abrir
   Logística → «Gasto combustible». Verificar que la tabla muestre exactamente
   los mismos nombres de vehículos, además de los filtros y dos totales
   y gráficas. Cambiar de página no debe cambiar los totales del filtro.
7. Cancelar una eliminación: debe conservarse el registro. Confirmarla:
   debe salir de la tabla y de las estadísticas, conservando `deletedAt` en DB.
8. Verificar ambas pantallas en móvil y las rutas directas con roles no
   autorizados. Los repartidores no deben ver la opción administrativa.

Pruebas automatizadas:

```powershell
cd backend
npm test -- --runInBand utils/logisticaCombustible.test.js services/logisticaCombustibleService.test.js routes/Logistica/combustibleRoutes.test.js
```

Integración optativa: requiere una base **local vacía y descartable** llamada
`rve_combustible_test` (o un sufijo de letras/números). El test crea fixtures y
limpia la tabla de combustible dentro de esa base. No usa `.env` ni `connectDB()`:

```powershell
# Ejemplo con el PostgreSQL temporal en el puerto 55439, autenticación local de prueba.
$env:RVE_COMBUSTIBLE_TEST_DATABASE_URL = 'postgres://postgres@127.0.0.1:55439/rve_combustible_test'
npm test -- --runInBand services/logisticaCombustibleService.integration.test.js
Remove-Item Env:RVE_COMBUSTIBLE_TEST_DATABASE_URL
```

Frontend:

```powershell
cd frontend
node --test src/utils/logisticaCombustible.test.js
node --test --test-name-pattern="combustible" src/config/routePermissions.test.js
node node_modules/eslint/bin/eslint.js src/pages/Logistica/GastoCombustible.jsx src/utils/logisticaCombustible.js src/config/routePermissions.js
npm run build
```

Resultado actualizado: 73 pruebas unitarias/regresión y 3 pruebas de integración
PostgreSQL aprobadas (catálogo de vehículos, compatibilidad con las migraciones
anteriores, permisos y esquema). Seis pruebas de formulario/gráficas del frontend
aprobaron, junto con ESLint de los archivos afectados y compilación Vite.
El archivo completo `routePermissions.test.js` presenta un fallo **preexistente**:
la ruta inicial con `Administracion` espera `/usuarios`, pero recibe
`/revisar-cajas`; se reprodujo usando los archivos de HEAD anteriores al cambio.
La revisión visual en navegador no pudo ejecutarse porque no había un navegador
conectado; queda cubierta por los pasos manuales anteriores.

## Archivos

Backend, creados:

- `models/LogisticaCombustibleRegistro.js`
- `utils/logisticaCombustible.js`
- `services/logisticaCombustibleService.js`
- `controllers/Logistica/combustibleController.js`
- `routes/Logistica/combustibleRoutes.js`
- `migrations/202610060001-create-logistica-combustible.sql`
- `migrations/202610060002-combustible-vehiculo-sin-consumo.sql`
- `migrations/202610060003-combustible-catalogo-vehiculos.sql`
- `scripts/migrateLogisticaCombustible.js`
- `utils/logisticaCombustible.test.js`
- `services/logisticaCombustibleService.test.js`
- `services/logisticaCombustibleService.integration.test.js`
- `routes/Logistica/combustibleRoutes.test.js`
- `docs/logistica-combustible.md`

Backend, modificados:

- `config/db.js`
- `models/associations.js`
- `index.js`
- `package.json`

Frontend, creados:

- `src/pages/Logistica/GastoCombustible.jsx`
- `src/utils/logisticaCombustible.js`
- `src/utils/logisticaCombustible.test.js`

Frontend, modificados:

- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/config/routePermissions.js`
- `src/config/routePermissions.test.js`
- `src/pages/Logistica/LogisticaPanel.jsx`
