import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../../test/utils/test-utils";
import React from "react";
import { useConversationStore } from "../../stores";

// Mock conversation store
const mockStartConversation = vi.fn();
const mockRunPipeline = vi.fn();

vi.mock("../../stores", () => ({
  useConversationStore: vi.fn((selector) => {
    const state = {
      isConversationStarted: false,
      startConversation: mockStartConversation,
      runPipeline: mockRunPipeline,
      messages: [],
      currentStepKey: null,
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock("../../stores/conversationStore", () => ({
  useConversationStore: vi.fn((selector) => {
    const state = {
      isConversationStarted: false,
      startConversation: mockStartConversation,
      runPipeline: mockRunPipeline,
      messages: [],
      currentStepKey: null,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock layout components
vi.mock("../../components/layout", () => ({
  AppLayout: ({ children }: any) => <div data-testid="app-layout">{children}</div>,
  SplitScreenLayout: () => <div data-testid="split-screen">Split</div>,
}));

// Mock Background and Animation
vi.mock("@/components/icons/Background", () => ({
  Background: () => <div data-testid="background">BG</div>,
}));

vi.mock("../Animation", () => ({
  Animation: () => <div data-testid="animation">Anim</div>,
}));

// Mock GenerateInput
vi.mock("../../components/home", () => ({
  GenerateInput: ({ value, onChange, onSubmit }: any) => (
    <div data-testid="generate-input">
      <input
        data-testid="gen-input-field"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
      />
      <button data-testid="gen-submit" onClick={onSubmit}>Go</button>
    </div>
  ),
}));

describe("HomePage", () => {
  beforeEach(() => {
    mockStartConversation.mockClear();
    mockRunPipeline.mockClear();
  });

  it("renders landing content when no conversation", async () => {
    const { HomePage } = await import("../HomePage");
    render(<HomePage />);
    expect(screen.getByTestId("app-layout")).toBeTruthy();
    expect(screen.getByTestId("background")).toBeTruthy();
    expect(screen.getByTestId("generate-input")).toBeTruthy();
  });

  it("renders title text", async () => {
    const { HomePage } = await import("../HomePage");
    render(<HomePage />);
    expect(screen.getByText(/generate a UFDR/i)).toBeTruthy();
  });

  it("handles input and submit", async () => {
    const { HomePage } = await import("../HomePage");
    render(<HomePage />);
    const input = screen.getByTestId("gen-input-field");
    fireEvent.change(input, { target: { value: "Create a story about neighbors" } });
    fireEvent.click(screen.getByTestId("gen-submit"));
    expect(mockStartConversation).toHaveBeenCalledWith("Create a story about neighbors");
  });

  it("does not submit empty input", async () => {
    const { HomePage } = await import("../HomePage");
    render(<HomePage />);
    fireEvent.click(screen.getByTestId("gen-submit"));
    expect(mockStartConversation).not.toHaveBeenCalled();
  });

  it("renders split screen when conversation started", async () => {
    vi.mocked(useConversationStore).mockImplementation((selector: any) => {
      const state = {
        isConversationStarted: true,
        startConversation: mockStartConversation,
        runPipeline: mockRunPipeline,
      };
      return selector ? selector(state) : state;
    });
    const { HomePage } = await import("../HomePage");
    render(<HomePage />);
    expect(screen.getByTestId("split-screen")).toBeTruthy();
  });
});
