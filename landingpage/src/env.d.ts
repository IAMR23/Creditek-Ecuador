/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly BACKEND_API_URL: string;
  // más variables de entorno...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
