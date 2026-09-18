# Webhook de reparto de oportunidades GHL

## Configuracion en RVE

Definir un secreto largo y aleatorio en el entorno del backend:

```env
GHL_REPARTO_WEBHOOK_SECRET=<secreto-generado-para-esta-integracion>
GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR=10
GHL_REPARTO_MAX_EXECUTION_MS=180000
GHL_REPARTO_CONNECTION_ACQUIRE_MS=10000
GHL_REPARTO_LOCK_QUERY_MS=5000
GHL_REPARTO_DB_OPERATION_MS=15000
GHL_REPARTO_CANCELLATION_GRACE_MS=30000
GHL_REPARTO_RETRY_BASE_MS=60000
GHL_REPARTO_RETRY_MAX_MS=1800000
GHL_REPARTO_LONG_RUNNING_MS=60000
GHL_REPARTO_LONG_RUNNING_INTERVAL_MS=60000
```

No reutilizar tokens de API de GHL, JWT de usuarios ni contrasenas. Reiniciar el backend despues de configurar la variable.

## Accion Webhook en el workflow de GHL

- Metodo: `POST`
- URL: `https://rve.creditek-ecuador.com/api/webhooks/ghl/reparto`
- Encabezado: `X-GHL-Webhook-Secret: <mismo-secreto-configurado-en-RVE>`
- Content-Type: `application/json`

Payload recomendado:

```json
{
  "opportunityId": "{{opportunity.id}}",
  "contactId": "{{contact.id}}",
  "locationId": "{{location.id}}",
  "workflowId": "{{workflow.id}}",
  "source": "workflow-reparto",
  "phone": "{{contact.phone}}"
}
```

`contactId` es el dato principal. `opportunityId` es opcional y acelera la consulta cuando GHL lo incluye. No se requieren `pipelineId` ni `stageId`: RVE usa `GHL_PIPELINE_ID` cuando esta configurado (o el primer pipeline devuelto por GHL como compatibilidad) y reconoce por nombre sus etapas WhatsApp y Facebook. Los valores pueden llegar en el nivel principal o anidados dentro del payload estandar de GHL. El telefono se acepta por compatibilidad, pero no se almacena ni se escribe en logs.

El reparto usa todos los asesores RVE vinculados con GHL que se encuentren en Play. La carga se calcula paginando por completo las oportunidades abiertas de las etapas WhatsApp y Facebook, incluidas las que ya tienen propietario. El limite se define con `GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR`; si falta o es invalido, se usa 10.

Las activaciones Play se registran en `ghl_reparto_revisiones_pendientes`. Las solicitudes concurrentes se agrupan y, si llegan durante una ejecucion, se realiza una revision posterior con el catalogo actualizado. Los logs `REPARTO_PROLONGADO` informan fase, duracion, paginas, oportunidades examinadas y asignaciones con frecuencia limitada; `RESUMEN_REPARTO` se emite una vez al finalizar.

Al arrancar y en cada ciclo del scheduler se recuperan automaticamente las revisiones cuyo `requestedVersion` sea mayor que `processedVersion`; no hace falta volver a pulsar Play despues de un reinicio. Cada espera de conexion y cada consulta de advisory lock tiene un limite. Los fallos consecutivos activan un backoff persistido de 1, 2, 4, 8 minutos, hasta un maximo predeterminado de 30 minutos. El estado sobrevive reinicios y tanto el scheduler como los webhooks respetan `retryAfter`.

Si el timeout global cancela el reparto pero una operacion ignora `AbortSignal` durante el periodo de gracia, solamente el reparto GHL entra en cuarentena: no se reinicia el backend. El advisory lock se conserva hasta que el trabajo anterior termine, por lo que no se abre otra ejecucion mientras un PUT anterior aun pudiera completarse. Las demas funciones de RVE siguen disponibles. Si la operacion no termina nunca, un reinicio administrativo libera la sesion, pero el backoff persistido evita un ciclo automatico de reinicios o intentos inmediatos.

Antes de cada PUT se consulta nuevamente la oportunidad. Si GHL aplico una asignacion pero se perdio la respuesta, la siguiente revision observa el propietario actual y la omite; no repite ni sobrescribe el PUT.

`GHL_PIPELINE_ID` es opcional cuando la ubicacion solo tiene un pipeline. Si no se define, se usa el unico/primer pipeline devuelto por GHL. Si se define, el reparto valida que el identificador exista en la ubicacion y detiene la ejecucion con `GHL_CONFIGURED_PIPELINE_NOT_FOUND` si no corresponde.

## Respuestas

- `202 Accepted`: evento nuevo registrado para procesamiento asincrono.
- `200 OK`: evento repetido reconocido mediante idempotencia; no se vuelve a procesar.
- `401 Unauthorized`: falta el encabezado secreto, el valor es incorrecto o la variable de entorno no esta configurada.
- `500 Internal Server Error`: no fue posible registrar el evento para procesamiento.

El acuse no significa necesariamente que la oportunidad fue asignada. Si aun no existe, tiene propietario, esta fuera de WhatsApp/Facebook, no hay asesores en Play/capacidad o existe otra ejecucion activa, queda intacta. Al pulsar Play se revisa inmediatamente la cola acumulada y el scheduler la vuelve a revisar cada minuto como respaldo, sin depender de una configuracion horaria activa.

## Seguridad y operacion

- El endpoint es publico y no usa JWT; su autenticacion exclusiva es el secreto del encabezado.
- No enviar el secreto dentro del JSON ni como parametro de URL.
- Los reintentos con el mismo identificador de evento o payload se deduplican.
- No se reasignan oportunidades con propietario.

## Actualizacion exclusiva del backend

Los siguientes comandos se ejecutan en el servidor despues de sustituir
`<COMMIT_SHA>` por el commit ya publicado que contiene esta correccion. No
cargan `.env` como un script: Docker Compose inyecta al contenedor de backend
sus variables `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_HOST` y `DB_PORT`.

```bash
cd /var/www/Creditek-Ecuador
git status --short
git fetch origin main
git merge --ff-only <COMMIT_SHA>

docker compose build backend
docker compose run --rm --no-deps -T backend npm run migrate:ghl-reviews
docker compose up -d --no-deps backend

docker compose ps backend postgres
docker compose logs --since=10m --tail=200 backend
```

El servicio de base de datos declarado por el repositorio se llama `postgres`.
La migracion se ejecuta desde la imagen de `backend`, no mediante `psql` con
suposiciones sobre `POSTGRES_*`, porque el backend tiene su propio juego de
credenciales `DB_*`. `build backend` no reinicia servicios; el unico servicio
recreado por `up -d --no-deps backend` es el backend.
