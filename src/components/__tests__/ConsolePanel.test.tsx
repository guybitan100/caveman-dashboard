import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/utils/test-utils";
import { ConsolePanel } from "../ufdr-runtime/ConsolePanel";

describe("ConsolePanel", () => {
  it("renders nothing when not visible and not popped out", () => {
    const { container } = render(
      <ConsolePanel
        lines={["test line"]}
        visible={false}
        poppedOut={false}
        onToggle={vi.fn()}
        onPopout={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders log lines when visible", () => {
    render(
      <ConsolePanel
        lines={["[INFO] Starting process", "[ERROR] Something failed"]}
        visible={true}
        poppedOut={false}
        onToggle={vi.fn()}
        onPopout={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Starting process/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Something failed/)
    ).toBeInTheDocument();
  });

  it("shows empty state when no lines", () => {
    render(
      <ConsolePanel
        lines={[]}
        visible={true}
        poppedOut={false}
        onToggle={vi.fn()}
        onPopout={vi.fn()}
      />
    );
    expect(screen.getByText("Awaiting stream")).toBeInTheDocument();
  });

  it("shows line count", () => {
    render(
      <ConsolePanel
        lines={["line 1", "line 2", "line 3"]}
        visible={true}
        poppedOut={false}
        onToggle={vi.fn()}
        onPopout={vi.fn()}
      />
    );
    expect(screen.getByText("3 lines")).toBeInTheDocument();
  });
});
