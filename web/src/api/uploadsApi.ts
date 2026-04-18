import axios from "axios";
import { SIX_API_UFDR_BASE_URL } from "./config.ts";

const apiClient = axios.create({
  baseURL: SIX_API_UFDR_BASE_URL,
  timeout: 30000,
});

export interface PresignedUrlResponse {
  url: string;
  fields: Record<string, string>;
}

/**
 * Check if a file with given MD5 hash already exists
 */
export async function doesFileExist(fileMd5: string): Promise<boolean> {
  const response = await apiClient.get(`/upload-file/${fileMd5}`);
  return response.data;
}

/**
 * Get presigned URL for uploading a file to S3
 */
export async function getUploadPresignedUrl(
  fileMd5: string
): Promise<PresignedUrlResponse> {
  const response = await apiClient.post(`/upload-file/${fileMd5}`);
  return response.data;
}

/**
 * Upload a file to S3 using presigned URL
 */
export async function uploadFileToS3(
  file: File,
  presignedUrl: PresignedUrlResponse,
  onProgress?: (progress: number) => void
): Promise<void> {
  const formData = new FormData();

  // Add all presigned fields first
  Object.entries(presignedUrl.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Add the file last (required by S3)
  formData.append("file", file);

  await axios.post(presignedUrl.url, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(progress);
      }
    },
  });
}
