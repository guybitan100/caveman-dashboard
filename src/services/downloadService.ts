import { v4 as uuidv4 } from "uuid";
import { jobsApi } from "../api/jobsApi";

export interface DownloadProgress {
  downloadId: string;
  fileName: string;
  totalBytes: number;
  downloadedBytes: number;
  speed: number;
  eta: number;
  status: "pending" | "downloading" | "paused" | "completed" | "failed";
  error?: string;
}

interface ActiveDownload {
  downloadId: string;
  jobId: string;
  fileName: string;
  url: string;
  totalBytes: number;
  downloadedBytes: number;
  fileHandle: FileSystemFileHandle;
  writableStream: FileSystemWritableFileStream;
  abortController: AbortController;
  chunkSize: number;
  lastChunkTimestamp: number;
  speedSamples: number[];
  onProgress: (progress: DownloadProgress) => void;
}

const CHUNK_SIZE = 15 * 1024 * 1024;
const MAX_RETRY_ATTEMPTS = 3;
const SPEED_SAMPLE_SIZE = 5;
const PARALLEL_DOWNLOADS = 6;

class DownloadService {
  private activeDownloads = new Map<string, ActiveDownload>();

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "showSaveFilePicker" in window &&
      typeof window.showSaveFilePicker === "function"
    );
  }

  async startDownload(
    jobId: string,
    fileName: string,
    onProgress: (progress: DownloadProgress) => void
  ): Promise<string> {
    const downloadId = uuidv4();

    try {
      const {
        url,
        fileSize,
        fileName: backendFileName,
      } = await jobsApi.getDownloadUrl(jobId);

      const suggestedName = backendFileName || fileName;

      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "UFDR File",
            accept: { "application/octet-stream": [".ufdr"] },
          },
        ],
      });

      const writableStream = await fileHandle.createWritable();

      const activeDownload: ActiveDownload = {
        downloadId,
        jobId,
        fileName: suggestedName,
        url,
        totalBytes: fileSize,
        downloadedBytes: 0,
        fileHandle: fileHandle as FileSystemFileHandle,
        writableStream: writableStream as FileSystemWritableFileStream,
        abortController: new AbortController(),
        chunkSize: CHUNK_SIZE,
        lastChunkTimestamp: Date.now(),
        speedSamples: [],
        onProgress,
      };

      this.activeDownloads.set(downloadId, activeDownload);
      this.updateProgress(activeDownload, { status: "pending" });
      this.downloadChunks(activeDownload);

      return downloadId;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Download canceled by user");
        }
        throw error;
      }
      throw new Error("Failed to start download");
    }
  }

  private async downloadChunks(download: ActiveDownload): Promise<void> {
    const { url, totalBytes, abortController } = download;
    const totalChunks = Math.ceil(totalBytes / download.chunkSize);

    const startingChunk = Math.floor(
      download.downloadedBytes / download.chunkSize
    );

    let nextToDownload = startingChunk;
    let nextToWrite = startingChunk;
    const completedChunks = new Map<number, ArrayBuffer>();
    const activeSlots = new Map<
      number,
      Promise<{ index: number; data: ArrayBuffer }>
    >();

    let lastProgressUpdate = Date.now();
    let bytesSinceLastUpdate = 0;

    const startChunkDownload = (
      chunkIndex: number
    ): Promise<{ index: number; data: ArrayBuffer }> => {
      const start = chunkIndex * download.chunkSize;
      const end = Math.min(start + download.chunkSize - 1, totalBytes - 1);

      return this.fetchChunkWithRetry(
        url,
        start,
        end,
        abortController.signal
      ).then((data) => ({ index: chunkIndex, data }));
    };

    const flushWriteQueue = async (): Promise<void> => {
      while (completedChunks.has(nextToWrite)) {
        const chunkData = completedChunks.get(nextToWrite)!;
        completedChunks.delete(nextToWrite);

        await download.writableStream.write(chunkData);
        download.downloadedBytes += chunkData.byteLength;
        bytesSinceLastUpdate += chunkData.byteLength;
        nextToWrite++;

        this.maybeUpdateProgress(
          download,
          totalBytes,
          bytesSinceLastUpdate,
          lastProgressUpdate,
          (newBytes, newTime) => {
            bytesSinceLastUpdate = newBytes;
            lastProgressUpdate = newTime;
          }
        );
      }
    };

    const refillDownloadPool = (): void => {
      while (
        activeSlots.size < PARALLEL_DOWNLOADS &&
        nextToDownload < totalChunks
      ) {
        const chunkIndex = nextToDownload++;
        activeSlots.set(chunkIndex, startChunkDownload(chunkIndex));
      }
    };

    try {
      refillDownloadPool();

      while (nextToWrite < totalChunks) {
        if (activeSlots.size === 0 && !completedChunks.has(nextToWrite)) {
          throw new Error(
            "Download stalled: no active downloads and next chunk not available"
          );
        }

        if (activeSlots.size > 0) {
          const { index, data } = await Promise.race(
            Array.from(activeSlots.values())
          );

          activeSlots.delete(index);
          completedChunks.set(index, data);
          refillDownloadPool();
        }

        await flushWriteQueue();
      }

      await download.writableStream.close();
      this.updateProgress(download, {
        status: "completed",
        downloadedBytes: totalBytes,
      });
      this.activeDownloads.delete(download.downloadId);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          completedChunks.clear();
          activeSlots.clear();
          return;
        }

        await download.writableStream.close();
        this.updateProgress(download, {
          status: "failed",
          error: error.message,
        });
        this.activeDownloads.delete(download.downloadId);
      } else {
        try {
          await download.writableStream.close();
        } catch {}
        this.updateProgress(download, {
          status: "failed",
          error: "Unknown error occurred",
        });
        this.activeDownloads.delete(download.downloadId);
      }
    }
  }

  private async fetchChunkWithRetry(
    url: string,
    start: number,
    end: number,
    signal: AbortSignal,
    attempt = 0
  ): Promise<ArrayBuffer> {
    try {
      const response = await fetch(url, {
        headers: {
          Range: `bytes=${start}-${end}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      if (attempt < MAX_RETRY_ATTEMPTS) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchChunkWithRetry(url, start, end, signal, attempt + 1);
      }

      throw error;
    }
  }

  private updateProgress(
    download: ActiveDownload,
    updates: Partial<DownloadProgress>
  ): void {
    const progress: DownloadProgress = {
      downloadId: download.downloadId,
      fileName: download.fileName,
      totalBytes: download.totalBytes,
      downloadedBytes: download.downloadedBytes,
      speed: 0,
      eta: 0,
      status: "downloading",
      ...updates,
    };

    download.onProgress(progress);
  }

  private maybeUpdateProgress(
    download: ActiveDownload,
    totalBytes: number,
    bytesSinceLastUpdate: number,
    lastProgressUpdate: number,
    updateState: (newBytes: number, newTime: number) => void
  ): boolean {
    const now = Date.now();
    const timeSinceLastUpdate = (now - lastProgressUpdate) / 1000;

    if (timeSinceLastUpdate < 0.1) {
      return false;
    }

    const currentSpeed = bytesSinceLastUpdate / timeSinceLastUpdate;

    download.speedSamples.push(currentSpeed);
    if (download.speedSamples.length > SPEED_SAMPLE_SIZE) {
      download.speedSamples.shift();
    }

    const averageSpeed =
      download.speedSamples.reduce((a, b) => a + b, 0) /
      Math.max(download.speedSamples.length, 1);

    const remainingBytes = totalBytes - download.downloadedBytes;
    const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0;

    this.updateProgress(download, {
      downloadedBytes: download.downloadedBytes,
      speed: averageSpeed,
      eta,
    });

    updateState(0, now);
    return true;
  }

  pauseDownload(downloadId: string): void {
    const download = this.activeDownloads.get(downloadId);
    if (!download) {
      throw new Error("Download not found");
    }

    download.abortController.abort();
    this.updateProgress(download, { status: "paused" });
  }

  async resumeDownload(downloadId: string): Promise<void> {
    const download = this.activeDownloads.get(downloadId);
    if (!download) {
      throw new Error("Download not found");
    }

    try {
      const { url } = await jobsApi.getDownloadUrl(download.jobId);
      download.url = url;
    } catch (error) {
      this.updateProgress(download, {
        status: "failed",
        error: "Failed to refresh download URL. Please try again.",
      });
      this.activeDownloads.delete(downloadId);
      return;
    }

    download.abortController = new AbortController();
    download.lastChunkTimestamp = Date.now();
    download.speedSamples = [];

    this.downloadChunks(download);
  }

  async cancelDownload(downloadId: string): Promise<void> {
    const download = this.activeDownloads.get(downloadId);
    if (!download) {
      return;
    }

    download.abortController.abort();

    try {
      await download.writableStream.close();
    } catch {}

    this.activeDownloads.delete(downloadId);
  }
}

export const downloadService = new DownloadService();
