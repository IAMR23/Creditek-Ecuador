# Webhook de reparto de oportunidades GHL

## Configuracion en RVE

Definir un secreto largo y aleatorio en el entorno del backend:

```env
GHL_REPARTO_WEBHOOK_SECRET=<secreto-generado-para-esta-integracion>
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

Los valores pueden llegar en el nivel principal o anidados dentro del payload estandar de GHL. Si `opportunityId` no esta disponible, `contactId` es obligatorio para buscar la oportunidad. El telefono se acepta por compatibilidad, pero no se almacena ni se escribe en logs.

## Respuestas

- `202 Accepted`: evento nuevo registrado para procesamiento asincrono.
- `200 OK`: evento repetido reconocido mediante idempotencia; no se vuelve a procesar.
- `401 Unauthorized`: falta el encabezado secreto, el valor es incorrecto o la variable de entorno no esta configurada.
- `500 Internal Server Error`: no fue posible registrar el evento para procesamiento.

El acuse no significa necesariamente que la oportunidad fue asignada. Si aun no existe, tiene propietario, cambio de etapa, no hay asesores en Play/capacidad o existe otra ejecucion activa, queda intacta. El scheduler periodico sigue siendo el mecanismo de respaldo.

## Seguridad y operacion

- El endpoint es publico y no usa JWT; su autenticacion exclusiva es el secreto del encabezado.
- No enviar el secreto dentro del JSON ni como parametro de URL.
- Los reintentos con el mismo identificador de evento o payload se deduplican.
- No se reasignan oportunidades con propietario.
