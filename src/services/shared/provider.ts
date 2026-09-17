export const sharedMode = Boolean(import.meta.env?.VITE_SUPABASE_URL?.trim() || import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim())
