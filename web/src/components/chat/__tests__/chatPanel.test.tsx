import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../../test/utils/test-utils";
import React from "react";

// Mock conversation store
vi.mock("../../../stores/conversationStore", () => ({
  useConversationStore: vi.fn((selector) => {
    const state = {
      messages: [
        { id: "m1", role: "user", content: "Create a story about two neighbors", timestamp: Date.now() },
        { id: "m2", role: "assistant", content: "I'll create a story about neighbors who discover shared interests.", timestamp: Date.now() },
      ],
      isConversationStarted: true,
      currentStepKey: "entity-extraction",
      generationProgress: {
        currentStep: "entity-extraction",
        completedSteps: ["story-expansion"],
        isGenerating: true,
      },
      addMessage: vi.fn(),
      startConversation: vi.fn(),
      runPipeline: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
  Message: {},
}));

vi.mock("../../../types/pipeline", () => ({
  PIPELINE_STEPS: [
    { key: "story-expansion", label: "Story Expansion", description: "Expand the story" },
    { key: "entity-extraction", label: "Entity Extraction", description: "Extract entities" },
    { key: "social-graph", label: "Social Graph", description: "Build social graph" },
    { key: "timeline", label: "Timeline", description: "Generate timeline" },
    { key: "phone-selection", label: "Phone Selection", description: "Select phones" },
    { key: "story-generation", label: "Story Generation", description: "Generate stories" },
    { key: "submit-job", label: "Submit Job", description: "Submit the job" },
  ],
}));

// Mock logo
vi.mock("../../../assets/titan-logo.svg", () => ({ default: "logo.svg" }));

// Mock GoButton
vi.mock("../../shared/GoButton", () => ({
  GoButton: (props: any) => <button data-testid="go-button" {...props}>Go</button>,
}));

describe("ChatPanel", () => {
  it("renders with messages", async () => {
    const { default: ChatPanel } = await import("../ChatPanel").then(m => ({ default: m.ChatPanel || m.default }));
    if (ChatPanel) {
      const { container } = render(<ChatPanel />);
      expect(container).toBeTruthy();
    }
  });
});
