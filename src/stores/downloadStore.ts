import { create } from "zustand";
import { DownloadProgress } from "../services/downloadService";

interface DownloadState {
  // Record of download ID to download progress
  downloads: Record<string, DownloadProgress>;

  // Actions
  addDownload: (download: DownloadProgress) => void;
  updateProgress: (
    downloadId: string,
    progress: Partial<DownloadProgress>
  ) => void;
  removeDownload: (downloadId: string) => void;

  // Selectors
  getDownload: (downloadId: string) => DownloadProgress | undefined;
  hasActiveDownloads: () => boolean;
  getActiveDownloads: () => DownloadProgress[];
  getActiveDownloadCount: () => number;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: {},

  addDownload: (download) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [download.downloadId]: download,
      },
    }));
  },

  updateProgress: (downloadId, progress) => {
    set((state) => {
      const existing = state.downloads[downloadId];
      if (!existing) return state;

      return {
        downloads: {
          ...state.downloads,
          [downloadId]: { ...existing, ...progress },
        },
      };
    });
  },

  removeDownload: (downloadId) => {
    set((state) => {
      const { [downloadId]: _, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },

  getDownload: (downloadId) => {
    return get().downloads[downloadId];
  },

  hasActiveDownloads: () => {
    const downloads = Object.values(get().downloads);
    return downloads.some(
      (d) => d.status === "downloading" || d.status === "pending"
    );
  },

  getActiveDownloads: () => {
    const downloads = Object.values(get().downloads);
    return downloads.filter(
      (d) =>
        d.status === "downloading" ||
        d.status === "pending" ||
        d.status === "paused"
    );
  },

  getActiveDownloadCount: () => {
    return get().getActiveDownloads().length;
  },
}));
