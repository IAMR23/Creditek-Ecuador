'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');

const { createApp, loadConfiguredLinks } = require('../index');

async function withServer(environment, callback) {
  const app = createApp(loadConfiguredLinks(environment));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('GET /health responde 200 y no se interpreta como slug', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('GET /credito redirige con 302 al destino configurado', async () => {
  const destination = 'https://wa.me/593984065314?text=Hola%2C%20necesito%20informacion';

  await withServer({ SHORTENER_LINK_CREDITO: destination }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/credito`, { redirect: 'manual' });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), destination);
  });
});

test('GET /contacto redirige solo cuando esta configurado', async () => {
  await withServer(
    { SHORTENER_LINK_CONTACTO: 'https://example.com/contacto' },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/contacto`, { redirect: 'manual' });

      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://example.com/contacto');
    },
  );

  await withServer({ SHORTENER_LINK_CONTACTO: '' }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/contacto`, { redirect: 'manual' });
    assert.equal(response.status, 404);
  });
});

test('un slug inexistente responde 404 sin detalles internos', async () => {
  await withServer({}, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/slug-inexistente`, { redirect: 'manual' });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Not found' });
  });
});

test('URLs invalidas o con esquemas inseguros se ignoran sin tumbar el servicio', async () => {
  const environment = {
    SHORTENER_LINK_INVALIDA: 'esto-no-es-una-url',
    SHORTENER_LINK_SCRIPT: 'javascript:alert(1)',
    SHORTENER_LINK_ARCHIVO: 'file:///etc/passwd',
  };

  await withServer(environment, async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/health`);
    const invalidResponse = await fetch(`${baseUrl}/invalida`, { redirect: 'manual' });

    assert.equal(healthResponse.status, 200);
    assert.equal(invalidResponse.status, 404);
  });
});
