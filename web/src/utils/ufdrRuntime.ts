import type {
  ExecutionMode,
  ModelMode,
  FormState,
  UfdrRequestPayload,
  LogFilter,
} from "../types/ufdrRuntime.ts";

export function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatDate(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds < 1) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function describeExecutionMode(
  executionMode: ExecutionMode,
  modelMode: ModelMode
): { value: string; note: string } {
  if (executionMode === "summary")
    return {
      value: "Read-only summary",
      note: "Inspects the selected UFDR without generating a new output.",
    };
  if (executionMode === "upload-only")
    return {
      value: "Upload existing UFDR",
      note: "Pushes the selected local UFDR to S3 as-is.",
    };
  if (modelMode === "uniform")
    return {
      value: "Duplicate with uniform targets",
      note: "Aims for the same total per detected model type.",
    };
  if (modelMode === "explicit")
    return {
      value: "Duplicate with explicit targets",
      note: "Uses exact totals for the model families you specify.",
    };
  return {
    value: "Duplicate by copy multiplier",
    note: "Repeats each discovered model by the selected multiplier.",
  };
}

export function describeOutputPolicy(form: FormState): {
  value: string;
  note: string;
} {
  if (form.executionMode === "summary")
    return {
      value: "No output file",
      note: "Summary mode reads the source only.",
    };
  if (form.executionMode === "upload-only")
    return {
      value: "Reuse selected UFDR",
      note: "Upload-only does not generate a new file.",
    };
  if (form.outputPath.trim())
    return {
      value: form.outputPath.trim(),
      note: "Custom destination for the generated UFDR.",
    };
  return {
    value: "Runtime default",
    note: "The runtime will choose the output filename.",
  };
}

export function describeDeliveryPolicy(form: FormState): {
  value: string;
  note: string;
} {
  if (form.executionMode === "summary")
    return {
      value: "No upload",
      note: "Summary mode never pushes data to S3.",
    };
  if (form.executionMode === "upload-only")
    return {
      value: form.deleteExisting
        ? "Upload and replace existing"
        : "Upload to S3",
      note: "Upload-only always sends the selected UFDR to S3.",
    };
  if (form.noUpload)
    return {
      value: "Keep local only",
      note: "Generated output stays local after the run completes.",
    };
  if (form.uploadToS3)
    return {
      value: form.deleteExisting
        ? "Upload and replace existing"
        : "Upload generated UFDR",
      note: "Pushes the generated output to S3 when the run completes.",
    };
  return {
    value: "Local output only",
    note: "No S3 upload is requested for this run.",
  };
}

export function buildRequestPayload(form: FormState): UfdrRequestPayload {
  const isDuplicateMode = form.executionMode === "duplicate";
  const isUniformMode = isDuplicateMode && form.modelMode === "uniform";
  const isExplicitMode = isDuplicateMode && form.modelMode === "explicit";
  const isUploadOnlyMode = form.executionMode === "upload-only";

  return {
    sourceMode: form.sourceMode,
    executionMode: form.executionMode,
    modelMode: form.modelMode,
    inputPath: form.selectedLocalFile || undefined,
    s3EvidenceId: form.s3EvidenceId.trim() || undefined,
    outputPath: isDuplicateMode
      ? form.outputPath.trim() || undefined
      : undefined,
    modelCopies:
      isDuplicateMode && form.modelMode === "copies"
        ? parseOptionalNumber(form.modelCopies)
        : undefined,
    uniformModelCount: isUniformMode
      ? parseOptionalNumber(form.uniformModelCount)
      : undefined,
    explicitModelCounts: isExplicitMode
      ? form.explicitModelCounts.trim() || undefined
      : undefined,
    excludeModelTypes: isUniformMode
      ? form.excludeModelTypes.trim() || undefined
      : undefined,
    fileCopies: isDuplicateMode
      ? parseOptionalNumber(form.fileCopies)
      : undefined,
    scale: isDuplicateMode ? parseOptionalNumber(form.scale) : undefined,
    audioSr: isDuplicateMode ? parseOptionalNumber(form.audioSr) : undefined,
    strDataRepeat: isDuplicateMode
      ? parseOptionalNumber(form.strDataRepeat)
      : undefined,
    uploadToS3: isUploadOnlyMode ? true : form.uploadToS3,
    deleteExisting:
      form.executionMode === "summary" ? false : form.deleteExisting,
    noUpload: isUploadOnlyMode ? false : form.noUpload,
    keepExtracted: isDuplicateMode ? form.keepExtracted : false,
  };
}

export function buildCommandPreview(form: FormState): string {
  const args: string[] = [];
  const sourceLabel =
    form.sourceMode === "local"
      ? form.selectedLocalFile || "ufdrs/<select-file>.ufdr"
      : form.s3EvidenceId.trim() || "<evidence-id>";

  if (form.executionMode === "summary") {
    args.push("--summary");
    args.push(
      form.sourceMode === "local" ? "--in" : "--src-s3",
      sourceLabel
    );
    return `python main.py ${args.join(" ")}`;
  }

  if (form.executionMode === "upload-only") {
    args.push("--s3-upload-only");
    args.push(
      form.sourceMode === "local" ? "--in" : "--src-s3",
      sourceLabel
    );
    if (form.deleteExisting) args.push("--delete");
    return `python main.py ${args.join(" ")}`;
  }

  if (form.modelMode === "copies") {
    args.push(form.modelCopies.trim() || "1");
  } else if (form.modelMode === "uniform") {
    args.push("--count", form.uniformModelCount.trim() || "1");
    if (form.excludeModelTypes.trim())
      args.push("--exclude", form.excludeModelTypes.trim());
  } else {
    args.push("--models", form.explicitModelCounts.trim() || "Chat=10");
  }

  args.push(form.sourceMode === "local" ? "--in" : "--src-s3", sourceLabel);

  if (form.outputPath.trim()) args.push("--out", form.outputPath.trim());
  if ((parseOptionalNumber(form.fileCopies) ?? 0) > 0)
    args.push("--copy-files", form.fileCopies.trim());
  if ((parseOptionalNumber(form.scale) ?? 1) !== 1)
    args.push("--scale", form.scale.trim());
  if (parseOptionalNumber(form.audioSr))
    args.push("--audio-sr", form.audioSr.trim());
  if (parseOptionalNumber(form.strDataRepeat))
    args.push("--str-data-repeat", form.strDataRepeat.trim());
  if (form.uploadToS3) args.push("--s3-upload-ufdr");
  if (form.deleteExisting) args.push("--delete");
  if (form.keepExtracted) args.push("--keep-extracted");
  if (form.noUpload) args.push("--no-upload");

  return `python main.py ${args.join(" ")}`;
}

export function classifyLogLine(
  line: string
): "error" | "warning" | "success" | "debug" | "info" | "trace" | "plain" {
  const l = line.toLowerCase();
  if (/\berror\b|\[error\]/.test(l)) return "error";
  if (/\bwarning\b|\bwarn\b|\[warn\]|\[warning\]/.test(l)) return "warning";
  if (/\bsuccess\b|\bcompleted\b|\bdone\b/.test(l)) return "success";
  if (/\bdebug\b|\[debug\]/.test(l)) return "debug";
  if (/\binfo\b|\[info\]/.test(l)) return "info";
  if (/\btrace\b|\[trace\]/.test(l)) return "trace";
  return "plain";
}

export function classifyLogFilter(
  line: string
): Exclude<LogFilter, "all"> | "other" {
  const level = classifyLogLine(line);
  if (level === "error") return "error";
  if (level === "warning") return "warning";
  if (level === "info") return "info";
  return "other";
}

export function describeSourceSummary(
  form: FormState,
  selectedFileDetails: { name: string; path: string; size: number } | null
): { value: string; note: string } {
  if (form.sourceMode === "local") {
    return {
      value: selectedFileDetails?.name ?? "Choose a local UFDR",
      note: selectedFileDetails
        ? `${selectedFileDetails.path} · ${formatFileSize(selectedFileDetails.size)}`
        : "Select a file from the runtime inventory or use the dropdown above.",
    };
  }
  return {
    value: form.s3EvidenceId.trim() || "Enter an S3 evidence id",
    note: form.s3EvidenceId.trim()
      ? "The runtime will stream the source package directly from S3."
      : "Use an evidence id when the source UFDR is not stored locally.",
  };
}
