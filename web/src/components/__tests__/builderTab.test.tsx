import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// BuilderTab is pure presentational - no stores/hooks to mock

describe("BuilderTab", () => {
  const defaultForm = {
    sourceMode: "local" as const,
    executionMode: "full" as const,
    modelMode: "uniform" as const,
    selectedLocalFile: "",
    s3EvidenceId: "",
    outputPath: "/output",
    modelCopies: "1",
    uniformModelCount: "1",
    explicitModelCounts: "",
    excludeModelTypes: "",
    fileCopies: "1",
    scale: "1",
    audioSr: "16000",
    strDataRepeat: "1",
    uploadToS3: false,
    deleteExisting: false,
    noUpload: false,
    keepExtracted: false,
  };

  it("renders with local source mode", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={defaultForm}
        localFiles={[]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "No file", note: "" }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with s3 source mode", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={{ ...defaultForm, sourceMode: "s3" as const }}
        localFiles={[]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "S3 source", note: "bucket" }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with local files available", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={defaultForm}
        localFiles={[{ name: "test.ufdr", path: "/data/test.ufdr", size: 1024 }]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "test.ufdr", note: "1 KB" }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders summary execution mode", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={{ ...defaultForm, executionMode: "summary" as const }}
        localFiles={[]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "No file", note: "" }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders explicit model mode", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={{ ...defaultForm, modelMode: "explicit" as const, explicitModelCounts: "iPhone15:2,Galaxy24:3" }}
        localFiles={[]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "No file", note: "" }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with upload options enabled", async () => {
    const { BuilderTab } = await import("../ufdr-runtime/BuilderTab");
    const { container } = render(
      <BuilderTab
        form={{ ...defaultForm, uploadToS3: true, deleteExisting: true, keepExtracted: true }}
        localFiles={[]}
        onUpdateField={vi.fn()}
        onRefreshSources={vi.fn()}
        sourceSummary={{ value: "No file", note: "" }}
      />
    );
    expect(container).toBeTruthy();
  });
});
