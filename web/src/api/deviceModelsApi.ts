import { apiClient } from "./jobsApi";
import { DeviceModel } from "../types/cart";

/**
 * Fetch all available device models from the backend.
 * GET /UFDR/device-models
 */
export async function getDeviceModels(): Promise<DeviceModel[]> {
  const response = await apiClient.get<DeviceModel[]>("/device-models");
  return response.data;
}
