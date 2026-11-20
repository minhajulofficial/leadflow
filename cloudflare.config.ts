import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "leadflow",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-19",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Public values (safe in browser). Never put secrets here.
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://tiqlpxwjezzckncchzut.supabase.co"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: bindings.text("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpcWxweHdqZXp6Y2tuY2NoenV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NTI0OTgsImV4cCI6MjEwOTAyODQ5OH0.8dMhdfXcFVxVSkURFHvZj154ZSw0VC2s9cigg0C9NIU"),
    },
  }),
});
