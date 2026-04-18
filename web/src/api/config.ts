export const TITAN_API_BASE_URL =
  import.meta.env.VITE_TITAN_API_URL || "http://localhost:8000";

export const TITAN_API_UFDR_BASE_URL = `${TITAN_API_BASE_URL}/UFDR`;

export const TITAN_METAFINDER_BASE_URL =
  import.meta.env.VITE_TITAN_METAFINDER_URL || "http://localhost:8001";

export const TITAN_AI_GENERATOR_BASE_URL =
  import.meta.env.VITE_AI_GENERATOR_URL || "http://localhost:8002";

export const UFDR_RUNTIME_BASE_URL =
  import.meta.env.VITE_UFDR_RUNTIME_URL || "http://localhost:8081";
