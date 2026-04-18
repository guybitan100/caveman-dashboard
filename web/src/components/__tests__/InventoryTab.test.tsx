import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/utils/test-utils";
import { InventoryTab } from "../ufdr-runtime/InventoryTab";
import type { LocalUfdrFile } from "../../types/ufdrRuntime";

describe("InventoryTab", () => {
  const mockFiles: LocalUfdrFile[] = [
    {
      name: "test1.ufdr",
      path: "ufdrs/test1.ufdr",
      size: 1024 * 1024,
      modifiedAt: "2024-06-01T10:00:00Z",
    },
    {
      name: "test2.ufdr",
      path: "ufdrs/test2.ufdr",
      size: 2048 * 1024,
      modifiedAt: "2024-06-02T10:00:00Z",
    },
  ];

  it("shows empty state when no files", () => {
    render(
      <InventoryTab
        localFiles={[]}
        selectedLocalFile=""
        inventoryError={null}
        onSelectFile={vi.fn()}
        onUpdateField={vi.fn()}
      />
    );
    expect(screen.getByText("No UFDR files found")).toBeInTheDocument();
  });

  it("shows file list", () => {
    render(
      <InventoryTab
        localFiles={mockFiles}
        selectedLocalFile=""
        inventoryError={null}
        onSelectFile={vi.fn()}
        onUpdateField={vi.fn()}
      />
    );
    expect(screen.getByText("test1.ufdr")).toBeInTheDocument();
    expect(screen.getByText("test2.ufdr")).toBeInTheDocument();
  });

  it("shows Selected chip for active file", () => {
    render(
      <InventoryTab
        localFiles={mockFiles}
        selectedLocalFile="ufdrs/test1.ufdr"
        inventoryError={null}
        onSelectFile={vi.fn()}
        onUpdateField={vi.fn()}
      />
    );
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("shows file count", () => {
    render(
      <InventoryTab
        localFiles={mockFiles}
        selectedLocalFile=""
        inventoryError={null}
        onSelectFile={vi.fn()}
        onUpdateField={vi.fn()}
      />
    );
    expect(screen.getByText("2 files")).toBeInTheDocument();
  });

  it("shows error alert when inventoryError set", () => {
    render(
      <InventoryTab
        localFiles={[]}
        selectedLocalFile=""
        inventoryError="Connection failed"
        onSelectFile={vi.fn()}
        onUpdateField={vi.fn()}
      />
    );
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });
});
