export type SourceMode = "local" | "s3";
export type ExecutionMode = "duplicate" | "summary" | "upload-only";
export type ModelMode = "copies" | "uniform" | "explicit";
export type RuntimeJobStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type TabId = "builder" | "launch" | "summary" | "inventory" | "logs";
export type LogFilter = "all" | "error" | "warning" | "info";

export interface UfdrRequestPayload {
  sourceMode?: SourceMode;
  executionMode?: ExecutionMode;
  modelMode?: ModelMode;
  inputPath?: string;
  s3EvidenceId?: string;
  outputPath?: string;
  modelCopies?: number;
  uniformModelCount?: number;
  explicitModelCounts?: string;
  excludeModelTypes?: string;
  fileCopies?: number;
  scale?: number;
  audioSr?: number;
  strDataRepeat?: number;
  uploadToS3?: boolean;
  deleteExisting?: boolean;
  noUpload?: boolean;
  keepExtracted?: boolean;
}

export interface LocalUfdrFile {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
}

export interface RuntimeJobSnapshot {
  id?: string;
  status: RuntimeJobStatus;
  commandLine: string;
  logs: string[];
  startedAt?: string;
  endedAt?: string;
  exitCode?: number | null;
  cancellationRequested?: boolean;
}

export interface AppInfo {
  appName: string;
  pythonCommand: string;
  runtimeRoot: string;
  availableUfdrs: number;
}

export interface SystemStats {
  hostname: string;
  nodeVersion: string;
  uptimeSeconds: number;
  memoryUsedPercent: number;
  loadAverage: number[];
}

export interface FormState {
  sourceMode: SourceMode;
  executionMode: ExecutionMode;
  modelMode: ModelMode;
  selectedLocalFile: string;
  s3EvidenceId: string;
  outputPath: string;
  modelCopies: string;
  uniformModelCount: string;
  explicitModelCounts: string;
  excludeModelTypes: string;
  fileCopies: string;
  scale: string;
  audioSr: string;
  strDataRepeat: string;
  uploadToS3: boolean;
  deleteExisting: boolean;
  noUpload: boolean;
  keepExtracted: boolean;
}

export interface TabSpec {
  id: TabId;
  label: string;
  tone: string;
  processing?: boolean;
}

export const EMPTY_JOB: RuntimeJobSnapshot = {
  status: "idle",
  commandLine: "",
  logs: [],
};

export const DEFAULT_FORM: FormState = {
  sourceMode: "local",
  executionMode: "duplicate",
  modelMode: "copies",
  selectedLocalFile: "",
  s3EvidenceId: "",
  outputPath: "",
  modelCopies: "3",
  uniformModelCount: "5",
  explicitModelCounts: "Chat=10,Contact=3",
  excludeModelTypes: "",
  fileCopies: "0",
  scale: "1",
  audioSr: "",
  strDataRepeat: "",
  uploadToS3: false,
  deleteExisting: false,
  noUpload: false,
  keepExtracted: false,
};

export const RUNTIME_STATUS_LABELS: Record<RuntimeJobStatus, string> = {
  idle: "Ready",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
