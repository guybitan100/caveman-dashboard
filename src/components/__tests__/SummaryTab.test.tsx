import { describe, it, expect } from "vitest";
import { render, screen } from "../../test/utils/test-utils";
import { SummaryTab } from "../ufdr-runtime/SummaryTab";

describe("SummaryTab", () => {
  it("shows empty state when no summary", () => {
    render(<SummaryTab summaryOutput="" summaryCommand="" />);
    expect(screen.getByText("No summary yet")).toBeInTheDocument();
  });

  it("shows summary output when provided", () => {
    render(
      <SummaryTab
        summaryOutput="Model count: 42"
        summaryCommand="python main.py --summary --in test.ufdr"
      />
    );
    expect(screen.getByText("Model count: 42")).toBeInTheDocument();
    expect(
      screen.getByText("python main.py --summary --in test.ufdr")
    ).toBeInTheDocument();
  });

  it("hides command block when no command", () => {
    render(<SummaryTab summaryOutput="output" summaryCommand="" />);
    expect(screen.getByText("output")).toBeInTheDocument();
    expect(
      screen.queryByText("Last summary command")
    ).not.toBeInTheDocument();
  });
});
