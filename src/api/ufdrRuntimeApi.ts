import axios from "axios";
import type {
  UfdrRequestPayload,
  LocalUfdrFile,
  RuntimeJobSnapshot,
  AppInfo,
  SystemStats,
} from "../types/ufdrRuntime.ts";

const RUNTIME_BASE_URL =
  import.meta.env.VITE_UFDR_RUNTIME_URL || "http://localhost:8081";

export const runtimeClient = axios.create({
  baseURL: RUNTIME_BASE_URL,
  timeout: 30000,
});

export const ufdrRuntimeApi = {
  async getHealth(): Promise<{ ok: boolean }> {
    const response = await runtimeClient.get<{ ok: boolean }>("/api/health");
    return response.data;
  },

  async getInfo(): Promise<AppInfo> {
    const response = await runtimeClient.get<AppInfo>("/api/info");
    return response.data;
  },

  async getSystemStats(): Promise<SystemStats> {
    const response = await runtimeClient.get<SystemStats>(
      "/api/system/stats"
    );
    return response.data;
  },

  async listLocalFiles(): Promise<LocalUfdrFile[]> {
    const response = await runtimeClient.get<{ files: LocalUfdrFile[] }>(
      "/api/ufdr/files"
    );
    return response.data.files;
  },

  async getCurrentJob(): Promise<RuntimeJobSnapshot> {
    const response = await runtimeClient.get<RuntimeJobSnapshot>(
      "/api/ufdr/jobs/current"
    );
    return response.data;
  },

  async runSummary(
    payload: UfdrRequestPayload
  ): Promise<{ commandLine: string; output: string }> {
    const response = await runtimeClient.post<{
      commandLine: string;
      output: string;
    }>("/api/ufdr/summary", payload);
    return response.data;
  },

  async runJob(payload: UfdrRequestPayload): Promise<RuntimeJobSnapshot> {
    const response = await runtimeClient.post<RuntimeJobSnapshot>(
      "/api/ufdr/run",
      payload
    );
    return response.data;
  },

  async cancelJob(): Promise<RuntimeJobSnapshot> {
    const response = await runtimeClient.post<RuntimeJobSnapshot>(
      "/api/ufdr/jobs/current/cancel"
    );
    return response.data;
  },

  async restart(): Promise<{ ok: boolean }> {
    const response = await runtimeClient.post<{ ok: boolean }>(
      "/api/restart"
    );
    return response.data;
  },

  async reset(): Promise<{ ok: boolean }> {
    const response = await runtimeClient.post<{ ok: boolean }>(
      "/api/reset"
    );
    return response.data;
  },
};
