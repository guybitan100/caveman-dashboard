import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../../test/utils/test-utils";
import React from "react";

// Mock all step output components
vi.mock("../step-outputs", () => ({
  EntitiesOutput: (props: any) => <div data-testid="entities-output">Entities</div>,
  PhoneSelectionOutput: (props: any) => <div data-testid="phone-output">Phones</div>,
  SocialGraphOutput: (props: any) => <div data-testid="social-output">Social</div>,
  StoryOutput: (props: any) => <div data-testid="story-output">Story</div>,
  TimelineOutput: (props: any) => <div data-testid="timeline-output">Timeline</div>,
}));

vi.mock("../step-outputs/StoryGenerationOutput", () => ({
  StoryGenerationOutput: (props: any) => <div data-testid="gen-output">Gen</div>,
}));

vi.mock("../step-outputs/SubmitJobOutput", () => ({
  SubmitJobOutput: (props: any) => <div data-testid="submit-output">Submit</div>,
}));

vi.mock("../../icons/AiStar", () => ({
  AIStar: () => <span>★</span>,
}));

vi.mock("../../icons/AiStarSpinner", () => ({
  AIStarSpinner: () => <span>⟳</span>,
}));

vi.mock("../CountdownTimer", () => ({
  CountdownTimer: () => <span>Timer</span>,
}));

vi.mock("../../shared/styledComponents", () => ({
  ActionButton: (props: any) => <button {...props}>{props.children}</button>,
}));

vi.mock("../../../types/pipeline", () => ({
  PIPELINE_STEPS: [
    { key: "story-expansion", label: "Story Expansion", description: "Expand the story", outputKey: "storyExpansion" },
    { key: "entity-extraction", label: "Entity Extraction", description: "Extract entities", outputKey: "entities" },
    { key: "social-graph", label: "Social Graph", description: "Build social graph", outputKey: "socialGraph" },
    { key: "timeline", label: "Timeline", description: "Generate timeline", outputKey: "timeline" },
    { key: "phone-selection", label: "Phone Selection", description: "Select phones", outputKey: "selectedPhones" },
    { key: "story-generation", label: "Story Generation", description: "Generate stories", outputKey: "generationResult" },
    { key: "submit-job", label: "Submit Job", description: "Submit the job", outputKey: "submittedJobs" },
  ],
}));

// Create step data for different states
const makeStep = (key: string, status: string, data?: any) => ({
  key,
  status,
  data: data || null,
  error: null,
  isEditing: false,
  isExpanded: status === "completed",
  startedAt: Date.now(),
  completedAt: status === "completed" ? Date.now() : null,
});

vi.mock("../../../stores/conversationStore", () => ({
  useConversationStore: vi.fn((selector) => {
    const state = {
      steps: new Map([
        ["story-expansion", makeStep("story-expansion", "completed", {
          original_description: "A love story",
          expanded_narrative: "In a small town...",
          setting: "Small town",
          key_themes: ["love", "discovery"],
          generated_at: "2024-01-01",
        })],
        ["entity-extraction", makeStep("entity-extraction", "running")],
        ["social-graph", makeStep("social-graph", "pending")],
        ["timeline", makeStep("timeline", "pending")],
        ["phone-selection", makeStep("phone-selection", "pending")],
        ["story-generation", makeStep("story-generation", "pending")],
        ["submit-job", makeStep("submit-job", "pending")],
      ]),
      generationProgress: {
        currentStep: "entity-extraction",
        completedSteps: ["story-expansion"],
        isGenerating: true,
      },
      isConversationStarted: true,
      getStepData: vi.fn((key: string) => {
        const steps: any = {
          "story-expansion": makeStep("story-expansion", "completed", {
            original_description: "A love story",
            expanded_narrative: "In a small town...",
            setting: "Small town",
            key_themes: ["love"],
            generated_at: "2024-01-01",
          }),
          "entity-extraction": makeStep("entity-extraction", "running"),
        };
        return steps[key] || makeStep(key, "pending");
      }),
      updateStepData: vi.fn(),
      toggleStepExpanded: vi.fn(),
      toggleStepEditing: vi.fn(),
      retryStep: vi.fn(),
      submitJobs: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
  StepData: {},
  StepStatus: {},
}));

describe("GenerationPanel", () => {
  it("renders the panel with steps", async () => {
    const { GenerationPanel } = await import("../GenerationPanel");
    const { container } = render(<GenerationPanel />);
    expect(container).toBeTruthy();
  });
});
