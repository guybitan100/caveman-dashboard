import { describe, it, expect } from "vitest";
import {
  parseOptionalNumber,
  formatFileSize,
  formatDate,
  formatDuration,
  describeExecutionMode,
  describeOutputPolicy,
  describeDeliveryPolicy,
  buildRequestPayload,
  buildCommandPreview,
  classifyLogLine,
  classifyLogFilter,
  describeSourceSummary,
} from "../ufdrRuntime";
import { DEFAULT_FORM } from "../../types/ufdrRuntime";
import type { FormState } from "../../types/ufdrRuntime";

describe("ufdrRuntime utils", () => {
  describe("parseOptionalNumber", () => {
    it("returns undefined for empty string", () => {
      expect(parseOptionalNumber("")).toBeUndefined();
      expect(parseOptionalNumber("  ")).toBeUndefined();
    });

    it("parses valid numbers", () => {
      expect(parseOptionalNumber("42")).toBe(42);
      expect(parseOptionalNumber("3.14")).toBe(3.14);
      expect(parseOptionalNumber(" 7 ")).toBe(7);
    });

    it("returns undefined for non-numeric strings", () => {
      expect(parseOptionalNumber("abc")).toBeUndefined();
      expect(parseOptionalNumber("NaN")).toBeUndefined();
    });
  });

  describe("formatFileSize", () => {
    it("formats bytes", () => {
      expect(formatFileSize(512)).toBe("512 B");
    });

    it("formats kilobytes", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    });

    it("formats gigabytes", () => {
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
    });
  });

  describe("formatDate", () => {
    it("returns dash for undefined", () => {
      expect(formatDate(undefined)).toBe("-");
    });

    it("formats a valid date string", () => {
      const result = formatDate("2024-06-15T10:30:00Z");
      expect(result).toBeTruthy();
      expect(result).not.toBe("-");
    });
  });

  describe("formatDuration", () => {
    it("returns 0m for no seconds", () => {
      expect(formatDuration(undefined)).toBe("0m");
      expect(formatDuration(0)).toBe("0m");
    });

    it("formats minutes", () => {
      expect(formatDuration(300)).toBe("5m");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(3660)).toBe("1h 1m");
    });
  });

  describe("describeExecutionMode", () => {
    it("describes summary mode", () => {
      const result = describeExecutionMode("summary", "copies");
      expect(result.value).toBe("Read-only summary");
    });

    it("describes upload-only mode", () => {
      const result = describeExecutionMode("upload-only", "copies");
      expect(result.value).toBe("Upload existing UFDR");
    });

    it("describes duplicate with uniform", () => {
      const result = describeExecutionMode("duplicate", "uniform");
      expect(result.value).toContain("uniform");
    });

    it("describes duplicate with explicit", () => {
      const result = describeExecutionMode("duplicate", "explicit");
      expect(result.value).toContain("explicit");
    });

    it("describes duplicate with copies", () => {
      const result = describeExecutionMode("duplicate", "copies");
      expect(result.value).toContain("copy multiplier");
    });
  });

  describe("describeOutputPolicy", () => {
    it("returns no output for summary", () => {
      const form = { ...DEFAULT_FORM, executionMode: "summary" as const };
      expect(describeOutputPolicy(form).value).toBe("No output file");
    });

    it("returns reuse for upload-only", () => {
      const form = { ...DEFAULT_FORM, executionMode: "upload-only" as const };
      expect(describeOutputPolicy(form).value).toBe("Reuse selected UFDR");
    });

    it("returns custom path when set", () => {
      const form = {
        ...DEFAULT_FORM,
        executionMode: "duplicate" as const,
        outputPath: "out/test.ufdr",
      };
      expect(describeOutputPolicy(form).value).toBe("out/test.ufdr");
    });

    it("returns runtime default when no path", () => {
      const form = {
        ...DEFAULT_FORM,
        executionMode: "duplicate" as const,
        outputPath: "",
      };
      expect(describeOutputPolicy(form).value).toBe("Runtime default");
    });
  });

  describe("describeDeliveryPolicy", () => {
    it("returns no upload for summary", () => {
      const form = { ...DEFAULT_FORM, executionMode: "summary" as const };
      expect(describeDeliveryPolicy(form).value).toBe("No upload");
    });

    it("returns upload for upload-only", () => {
      const form = { ...DEFAULT_FORM, executionMode: "upload-only" as const };
      expect(describeDeliveryPolicy(form).value).toBe("Upload to S3");
    });

    it("returns replace when deleteExisting", () => {
      const form = {
        ...DEFAULT_FORM,
        executionMode: "upload-only" as const,
        deleteExisting: true,
      };
      expect(describeDeliveryPolicy(form).value).toContain("replace");
    });

    it("returns keep local when noUpload", () => {
      const form = {
        ...DEFAULT_FORM,
        executionMode: "duplicate" as const,
        noUpload: true,
      };
      expect(describeDeliveryPolicy(form).value).toBe("Keep local only");
    });

    it("returns upload when uploadToS3", () => {
      const form = {
        ...DEFAULT_FORM,
        executionMode: "duplicate" as const,
        uploadToS3: true,
      };
      expect(describeDeliveryPolicy(form).value).toContain("Upload");
    });

    it("returns local output only by default", () => {
      expect(describeDeliveryPolicy(DEFAULT_FORM).value).toBe(
        "Local output only"
      );
    });
  });

  describe("buildRequestPayload", () => {
    it("builds payload for default duplicate mode", () => {
      const payload = buildRequestPayload(DEFAULT_FORM);
      expect(payload.executionMode).toBe("duplicate");
      expect(payload.sourceMode).toBe("local");
      expect(payload.modelMode).toBe("copies");
      expect(payload.modelCopies).toBe(3);
    });

    it("builds payload for summary mode", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        executionMode: "summary",
      };
      const payload = buildRequestPayload(form);
      expect(payload.executionMode).toBe("summary");
      expect(payload.modelCopies).toBeUndefined();
      expect(payload.deleteExisting).toBe(false);
    });

    it("builds payload for upload-only mode", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        executionMode: "upload-only",
      };
      const payload = buildRequestPayload(form);
      expect(payload.uploadToS3).toBe(true);
      expect(payload.noUpload).toBe(false);
    });

    it("includes uniform fields only for uniform mode", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        modelMode: "uniform",
        uniformModelCount: "10",
        excludeModelTypes: "Chat",
      };
      const payload = buildRequestPayload(form);
      expect(payload.uniformModelCount).toBe(10);
      expect(payload.excludeModelTypes).toBe("Chat");
      expect(payload.modelCopies).toBeUndefined();
    });

    it("includes explicit fields only for explicit mode", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        modelMode: "explicit",
        explicitModelCounts: "Chat=10,Contact=5",
      };
      const payload = buildRequestPayload(form);
      expect(payload.explicitModelCounts).toBe("Chat=10,Contact=5");
      expect(payload.uniformModelCount).toBeUndefined();
    });
  });

  describe("buildCommandPreview", () => {
    it("builds summary command", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        executionMode: "summary",
        sourceMode: "local",
        selectedLocalFile: "test.ufdr",
      };
      const cmd = buildCommandPreview(form);
      expect(cmd).toContain("--summary");
      expect(cmd).toContain("--in");
      expect(cmd).toContain("test.ufdr");
    });

    it("builds upload-only command", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        executionMode: "upload-only",
        selectedLocalFile: "test.ufdr",
      };
      const cmd = buildCommandPreview(form);
      expect(cmd).toContain("--s3-upload-only");
    });

    it("builds duplicate copies command", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        executionMode: "duplicate",
        modelMode: "copies",
        modelCopies: "5",
        selectedLocalFile: "test.ufdr",
      };
      const cmd = buildCommandPreview(form);
      expect(cmd).toContain("5");
      expect(cmd).toContain("--in");
    });

    it("builds S3 source command", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        sourceMode: "s3",
        s3EvidenceId: "ev-123",
      };
      const cmd = buildCommandPreview(form);
      expect(cmd).toContain("--src-s3");
      expect(cmd).toContain("ev-123");
    });

    it("includes optional flags", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        uploadToS3: true,
        deleteExisting: true,
        keepExtracted: true,
        noUpload: true,
        fileCopies: "5",
        scale: "2",
        audioSr: "48000",
        strDataRepeat: "3",
      };
      const cmd = buildCommandPreview(form);
      expect(cmd).toContain("--s3-upload-ufdr");
      expect(cmd).toContain("--delete");
      expect(cmd).toContain("--keep-extracted");
      expect(cmd).toContain("--no-upload");
      expect(cmd).toContain("--copy-files");
      expect(cmd).toContain("--scale");
      expect(cmd).toContain("--audio-sr");
      expect(cmd).toContain("--str-data-repeat");
    });
  });

  describe("classifyLogLine", () => {
    it("classifies error lines", () => {
      expect(classifyLogLine("ERROR: something failed")).toBe("error");
      expect(classifyLogLine("[ERROR] crash")).toBe("error");
    });

    it("classifies warning lines", () => {
      expect(classifyLogLine("WARNING: check this")).toBe("warning");
      expect(classifyLogLine("[WARN] slow")).toBe("warning");
    });

    it("classifies success lines", () => {
      expect(classifyLogLine("Task completed successfully")).toBe("success");
      expect(classifyLogLine("Done!")).toBe("success");
    });

    it("classifies info lines", () => {
      expect(classifyLogLine("[INFO] processing")).toBe("info");
    });

    it("classifies debug lines", () => {
      expect(classifyLogLine("[DEBUG] detail")).toBe("debug");
    });

    it("returns plain for unclassified", () => {
      expect(classifyLogLine("some regular output")).toBe("plain");
    });
  });

  describe("classifyLogFilter", () => {
    it("classifies error", () => {
      expect(classifyLogFilter("[ERROR] fail")).toBe("error");
    });

    it("classifies warning", () => {
      expect(classifyLogFilter("[WARNING] check")).toBe("warning");
    });

    it("classifies info", () => {
      expect(classifyLogFilter("[INFO] ok")).toBe("info");
    });

    it("returns other for non-matching", () => {
      expect(classifyLogFilter("plain text")).toBe("other");
    });
  });

  describe("describeSourceSummary", () => {
    it("describes local source with file details", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        sourceMode: "local",
      };
      const details = { name: "test.ufdr", path: "ufdrs/test.ufdr", size: 1024 };
      const result = describeSourceSummary(form, details);
      expect(result.value).toBe("test.ufdr");
      expect(result.note).toContain("1.0 KB");
    });

    it("describes local source without file details", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        sourceMode: "local",
      };
      const result = describeSourceSummary(form, null);
      expect(result.value).toBe("Choose a local UFDR");
    });

    it("describes S3 source with evidence id", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        sourceMode: "s3",
        s3EvidenceId: "ev-123",
      };
      const result = describeSourceSummary(form, null);
      expect(result.value).toBe("ev-123");
    });

    it("describes S3 source without evidence id", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        sourceMode: "s3",
        s3EvidenceId: "",
      };
      const result = describeSourceSummary(form, null);
      expect(result.value).toContain("Enter");
    });
  });
});
