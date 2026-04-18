export const SIX_API_BASE_URL =
  import.meta.env.VITE_SIX_API_URL || "http://localhost:8000";

export const SIX_API_UFDR_BASE_URL = `${SIX_API_BASE_URL}/UFDR`;

export const SIX_METAFINDER_BASE_URL =
  import.meta.env.VITE_SIX_METAFINDER_URL || "http://localhost:8001";

export const SIX_AI_GENERATOR_BASE_URL =
  import.meta.env.VITE_AI_GENERATOR_URL || "http://localhost:8002";

export const UFDR_RUNTIME_BASE_URL =
  import.meta.env.VITE_UFDR_RUNTIME_URL || "http://localhost:8081";
