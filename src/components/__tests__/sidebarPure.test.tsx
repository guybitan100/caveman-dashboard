import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/utils/test-utils";
import React from "react";

// Pure presentational — no mocks needed for stores/hooks

describe("JobCard", () => {
  it("renders a Draft job", async () => {
    const { JobCard } = await import("../sidebar/JobCard");
    render(
      <JobCard
        job={{ id: "j1", name: "My Job", status: "Draft", timestamp: "2024-06-01T12:00:00Z", user: "user@test.com" }}
        isSelected={false}
        onClick={vi.fn()}
      />
    );
    expect(screen.getByText("My Job")).toBeTruthy();
  });

  it("renders selected state", async () => {
    const { JobCard } = await import("../sidebar/JobCard");
    const { container } = render(
      <JobCard
        job={{ id: "j2", name: "Selected Job", status: "Generating", timestamp: "2024-06-01T12:00:00Z", user: "user@test.com" }}
        isSelected={true}
        onClick={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders with delete callback", async () => {
    const { JobCard } = await import("../sidebar/JobCard");
    const { container } = render(
      <JobCard
        job={{ id: "j3", name: "Deletable", status: "Done", timestamp: "2024-06-01T12:00:00Z", user: "user@test.com" }}
        isSelected={false}
        isDeleting={false}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders deleting state", async () => {
    const { JobCard } = await import("../sidebar/JobCard");
    const { container } = render(
      <JobCard
        job={{ id: "j4", name: "Deleting", status: "Draft", timestamp: "2024-06-01T12:00:00Z", user: "user@test.com" }}
        isSelected={false}
        isDeleting={true}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders all status types", async () => {
    const { JobCard } = await import("../sidebar/JobCard");
    const statuses = ["Draft", "Generating", "Converting", "Finalizing", "Done", "Failed", "Cancelled", "Pending"];
    for (const status of statuses) {
      const { unmount } = render(
        <JobCard
          job={{ id: `j-${status}`, name: `${status} Job`, status: status as any, timestamp: "2024-06-01T12:00:00Z", user: "user@test.com" }}
          isSelected={false}
          onClick={vi.fn()}
        />
      );
      unmount();
    }
  });
});

describe("NewJobDialog", () => {
  it("renders closed", async () => {
    const { NewJobDialog } = await import("../sidebar/NewJobDialog");
    const { container } = render(
      <NewJobDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} isCreating={false} />
    );
    expect(container).toBeTruthy();
  });

  it("renders open", async () => {
    const { NewJobDialog } = await import("../sidebar/NewJobDialog");
    const { container } = render(
      <NewJobDialog open={true} onClose={vi.fn()} onCreate={vi.fn()} isCreating={false} />
    );
    expect(container).toBeTruthy();
  });

  it("renders creating state", async () => {
    const { NewJobDialog } = await import("../sidebar/NewJobDialog");
    const { container } = render(
      <NewJobDialog open={true} onClose={vi.fn()} onCreate={vi.fn()} isCreating={true} />
    );
    expect(container).toBeTruthy();
  });
});

describe("LoadingState", () => {
  it("renders with default count", async () => {
    const { LoadingState } = await import("../sidebar/LoadingState");
    const { container } = render(<LoadingState />);
    expect(container).toBeTruthy();
  });

  it("renders with custom count", async () => {
    const { LoadingState } = await import("../sidebar/LoadingState");
    const { container } = render(<LoadingState count={3} />);
    expect(container).toBeTruthy();
  });
});

describe("ErrorState", () => {
  it("renders with retry", async () => {
    const { ErrorState } = await import("../sidebar/ErrorState");
    const { container } = render(<ErrorState message="Network error" onRetry={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

describe("NewJobButton", () => {
  it("renders", async () => {
    const { NewJobButton } = await import("../sidebar/NewJobButton");
    const { container } = render(<NewJobButton onClick={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

describe("SearchBar", () => {
  it("renders", async () => {
    const { SearchBar } = await import("../sidebar/SearchBar");
    const { container } = render(<SearchBar value="" onChange={vi.fn()} />);
    expect(container).toBeTruthy();
  });
});

describe("JobStatusIndicator", () => {
  it("renders", async () => {
    const { JobStatusIndicator } = await import("../sidebar/JobStatusIndicator");
    const { container } = render(<JobStatusIndicator status="Draft" />);
    expect(container).toBeTruthy();
  });
});
