/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_FEATURE_ACADEMY?: string
  readonly VITE_FEATURE_ACCOUNT_SYNC?: string
  readonly VITE_FEATURE_DAILY_SPRINT?: string
  readonly VITE_FEATURE_QUANTUM_COHERENCE?: string
  readonly VITE_FEATURE_SUPPORTER?: string
  readonly VITE_SUPPORTER_CHECKOUT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
