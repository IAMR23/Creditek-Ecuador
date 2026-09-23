/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_BACKEND_API_URL?: string;
  // más variables de entorno...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
