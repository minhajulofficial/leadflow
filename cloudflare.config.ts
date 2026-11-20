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
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://iwkucjohxefyledxazir.supabase.co"),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: bindings.text("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3a3Vjam9oeGVmeWxlZHhhemlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMTA0NjEsImV4cCI6MjExMDY4NjQ2MX0.kEFw3ywwzCM3KjnrvNL1a1j4_QEjj5-TVN0QsEQNE0U"),
    },
  }),
});
