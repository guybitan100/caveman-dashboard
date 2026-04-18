import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "../../../../test/utils/test-utils";
import React from "react";

// Mock the upload API
vi.mock("../../../api/uploadsApi", () => ({
  doesFileExist: vi.fn().mockResolvedValue(false),
  getUploadPresignedUrl: vi.fn().mockResolvedValue({ url: "https://example.com/upload", fields: {} }),
  uploadFileToS3: vi.fn().mockResolvedValue(true),
}));

// Mock metafinder API
vi.mock("../../../api/metafinderApi", () => ({
  metafinderApi: {
    getOptions: vi.fn().mockResolvedValue({}),
    getFiles: vi.fn().mockResolvedValue({ files: [] }),
    getFileUrl: vi.fn().mockResolvedValue("https://example.com/file.jpg"),
  },
  MetaFinderDataType: { IMAGE: "image", AUDIO: "audio", VIDEO: "video" },
}));

// Mock styled components
vi.mock("../../shared/styledComponents", () => ({
  EmptyState: ({ children }: any) => <div data-testid="empty-state">{children}</div>,
  SectionCard: ({ children }: any) => <div>{children}</div>,
  StyledSelect: (props: any) => <select {...props} />,
  CreateNewMenuItem: (props: any) => <option {...props} />,
}));

describe("FileUploader", () => {
  it("renders upload area", async () => {
    const { FileUploader } = await import("../FileUploader");
    const { container } = render(
      <FileUploader dataType="image" onComplete={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { FileUploader } = await import("../FileUploader");
    const { container } = render(
      <FileUploader dataType="image" onComplete={vi.fn()} disabled />
    );
    expect(container).toBeTruthy();
  });
});

describe("MetaFinderGallery", () => {
  it("renders with image data type", async () => {
    const { MetaFinderGallery } = await import("../MetaFinderGallery");
    const { container } = render(
      <MetaFinderGallery dataType="image" onSelect={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders with audio data type", async () => {
    const { MetaFinderGallery } = await import("../MetaFinderGallery");
    const { container } = render(
      <MetaFinderGallery dataType="audio" onSelect={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { MetaFinderGallery } = await import("../MetaFinderGallery");
    const { container } = render(
      <MetaFinderGallery dataType="image" onSelect={vi.fn()} disabled />
    );
    expect(container).toBeTruthy();
  });

  it("renders with selected key", async () => {
    const { MetaFinderGallery } = await import("../MetaFinderGallery");
    const { container } = render(
      <MetaFinderGallery dataType="image" onSelect={vi.fn()} selectedKey="abc123" />
    );
    expect(container).toBeTruthy();
  });
});

describe("FilePicker", () => {
  it("renders with image type", async () => {
    const { FilePicker } = await import("../FilePicker");
    const { container } = render(
      <FilePicker dataType="image" value={null} onChange={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders with selected file value", async () => {
    const { FilePicker } = await import("../FilePicker");
    const { container } = render(
      <FilePicker
        dataType="image"
        value={{ file_type: "metafinder", md5: "abc123", file_name: "test.jpg" } as any}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders disabled", async () => {
    const { FilePicker } = await import("../FilePicker");
    const { container } = render(
      <FilePicker dataType="image" value={null} onChange={vi.fn()} disabled />
    );
    expect(container).toBeTruthy();
  });

  it("renders with error", async () => {
    const { FilePicker } = await import("../FilePicker");
    const { container } = render(
      <FilePicker dataType="image" value={null} onChange={vi.fn()} error="Required" />
    );
    expect(container).toBeTruthy();
  });
});
