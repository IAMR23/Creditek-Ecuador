# Webhook GHL a Meta Conversions API para WhatsApp Purchase

Endpoint:

```txt
POST /api/meta/whatsapp-purchase
```

Este webhook debe configurarse en GoHighLevel solo cuando la oportunidad llegue a una etapa de venta cerrada, por ejemplo `Vendido`, `Venta`, `Venta cerrada`, `Cliente compro` o estado `Won/Ganado`. No debe dispararse para leads nuevos ni conversaciones abiertas.

## Variables requeridas

```env
META_API_VERSION=vXX.X
META_DATASET_ID=TU_DATASET_ID
META_ACCESS_TOKEN=TU_ACCESS_TOKEN
META_PAGE_ID=TU_PAGE_ID
GHL_WEBHOOK_SECRET=CLAVE_SECRETA_COMPARTIDA
```

La URL enviada a Meta se construye asi:

```txt
https://graph.facebook.com/${META_API_VERSION}/${META_DATASET_ID}/events?access_token=${META_ACCESS_TOKEN}
```

## Payload desde GHL

```json
{
  "secret": "CLAVE_SECRETA_COMPARTIDA",
  "opportunityId": "{{opportunity.id}}",
  "contactId": "{{contact.id}}",
  "ctwaClid": "{{contact.custom_fields.ctwaClid}}",
  "phone": "{{contact.phone}}",
  "email": "{{contact.email}}",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "value": "{{opportunity.monetary_value}}",
  "currency": "USD",
  "productName": "{{contact.custom_fields.producto_interes}}",
  "productCategory": "Celulares"
}
```

## Validaciones

- `secret` debe coincidir con `GHL_WEBHOOK_SECRET`; si no coincide responde `401`.
- `ctwaClid` es obligatorio; si no llega responde `400` porque no se puede atribuir correctamente a WhatsApp Ads.
- `opportunityId` o `contactId` es obligatorio para generar `event_id`.
- `value` se convierte a numero; si no es valido se envia `0`.
- `currency` usa `USD` por defecto.

Los datos personales se normalizan y hashean con SHA-256 antes de enviarse a Meta:

- `phone` -> solo numeros -> `ph`
- `email` -> trim + lowercase -> `em`
- `firstName` -> trim + lowercase -> `fn`
- `lastName` -> trim + lowercase -> `ln`

## Prueba con curl

```bash
curl -X POST http://localhost:5020/api/meta/whatsapp-purchase \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "CLAVE_SECRETA_COMPARTIDA",
    "opportunityId": "test_001",
    "contactId": "contact_001",
    "ctwaClid": "Afiw8dWbYi1gtfUj9w7AfOQC-Ykzx4sqyHj9hRF0XXRBCqQ5sJzE4bmjjkzB71",
    "phone": "593984065314",
    "email": "cliente@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
    "value": 123,
    "currency": "USD",
    "productName": "HONOR X5c Plus",
    "productCategory": "Celulares"
  }'
```

En Postman usa metodo `POST`, header `Content-Type: application/json` y el mismo body JSON.

## Configuracion en GHL

1. Crear un workflow que se active al cambiar la oportunidad a la etapa cerrada de venta o a estado `Won/Ganado`.
2. Agregar accion Webhook con metodo `POST`.
3. URL de produccion: `https://TU_DOMINIO/api/meta/whatsapp-purchase`.
4. Enviar el body JSON anterior y asegurar que el custom field de `ctwaClid` corresponda al campo real guardado en GHL.
5. No reutilizar este webhook en etapas de lead, contacto nuevo, seguimiento o conversacion sin compra.

## Configuracion en Meta

1. Usar el Dataset/Pixels asociado al negocio y a WhatsApp Ads.
2. Crear o usar un access token de servidor con permisos para enviar eventos al dataset.
3. Configurar `META_PAGE_ID` con el Page ID de Meta asociado al anuncio Click-to-WhatsApp.
4. Verificar en Events Manager que llegue un evento `Purchase` con `action_source=business_messaging`, `messaging_channel=whatsapp` y `user_data.ctwa_clid`.
