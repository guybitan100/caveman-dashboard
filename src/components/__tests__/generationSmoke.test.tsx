import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock all dependencies
vi.mock("../../stores/conversationStore", () => ({
  useConversationStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        isConversationStarted: false,
        messages: [],
        isLoading: false,
        initialPrompt: "",
        isGenerating: false,
        generationProgress: {
          currentStep: null,
          steps: {
            "story-expansion": "pending",
            "entity-extraction": "pending",
            "social-graph": "pending",
            "timeline": "pending",
            "phone-selection": "pending",
            "story-generation": "pending",
            "submit-job": "pending",
          },
          stepData: {},
          expandedSteps: {
            "story-expansion": false,
            "entity-extraction": false,
            "social-graph": false,
            "timeline": false,
            "phone-selection": false,
            "story-generation": false,
            "submit-job": false,
          },
        },
        autoContinue: { isActive: false, remainingSeconds: 15, stepKey: null },
        editingStep: null,
        editedData: {},
        error: null,
        startConversation: vi.fn(),
        addMessage: vi.fn(),
        setLoading: vi.fn(),
        startGeneration: vi.fn(),
        runPipeline: vi.fn(),
        updateGenerationStep: vi.fn(),
        setCurrentStep: vi.fn(),
        setStepData: vi.fn(),
        toggleStepExpanded: vi.fn(),
        startAutoContinue: vi.fn(),
        stopAutoContinue: vi.fn(),
        tickAutoContinue: vi.fn(),
        continueToNextStep: vi.fn(),
        retryStep: vi.fn(),
        startEditing: vi.fn(),
        cancelEditing: vi.fn(),
        saveEdits: vi.fn(),
        updateEditedData: vi.fn(),
        resetConversation: vi.fn(),
        setError: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../stores", () => ({
  useConversationStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        isConversationStarted: false,
        messages: [],
        isLoading: false,
        isGenerating: false,
        generationProgress: { currentStep: null, steps: {}, stepData: {}, expandedSteps: {} },
        autoContinue: { isActive: false, remainingSeconds: 15, stepKey: null },
        editingStep: null,
        error: null,
        startConversation: vi.fn(),
        runPipeline: vi.fn(),
        resetConversation: vi.fn(),
        continueToNextStep: vi.fn(),
        retryStep: vi.fn(),
        startEditing: vi.fn(),
        cancelEditing: vi.fn(),
        saveEdits: vi.fn(),
        stopAutoContinue: vi.fn(),
        updateEditedData: vi.fn(),
        toggleStepExpanded: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../../contexts", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { email: "test@cellebrite.com", firstName: "Test", lastName: "User" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe("Generation - Step Outputs Smoke Tests", () => {
  it("renders EntitiesOutput", async () => {
    const { EntitiesOutput } = await import("../generation/step-outputs/EntitiesOutput");
    const { container } = render(
      <EntitiesOutput
        data={[{
          entity_id: "e1", name: "John",
          characteristics: { gender: "male", personality_traits: [], tech_savviness: 5, social_activity: 5 },
          languages: [{ name: "english", is_native: true, proficiency: "native" }],
          phone_numbers: ["+1"], emails: [],
        } as any]}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders TimelineOutput", async () => {
    const { TimelineOutput } = await import("../generation/step-outputs/TimelineOutput");
    const { container } = render(
      <TimelineOutput
        data={[{
          event_id: "ev1", timestamp: "2024-01-01T00:00:00Z",
          category: "communication", involved_entities: ["e1"],
          primary_entity: "e1",
        } as any]}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders SocialGraphOutput", async () => {
    const { SocialGraphOutput } = await import("../generation/step-outputs/SocialGraphOutput");
    const { container } = render(
      <SocialGraphOutput
        data={{ relationships: [{
          entity_id_1: "A", entity_id_2: "B", relationship_type: "friend",
          strength: 5, description: "friends", is_bidirectional: true, communication_frequency: 3,
        } as any] }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders PhoneSelectionOutput", async () => {
    const { PhoneSelectionOutput } = await import("../generation/step-outputs/PhoneSelectionOutput");
    const { container } = render(
      <PhoneSelectionOutput
        data={[{
          entity_id: "e1", entity_name: "John",
          device_type: "mobile", phone_number: "+1",
        } as any]}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders StoryGenerationOutput", async () => {
    const { StoryGenerationOutput } = await import("../generation/step-outputs/StoryGenerationOutput");
    const { container } = render(
      <StoryGenerationOutput
        data={{
          session_id: "s1", total_stories_generated: 5, total_jobs_created: 1,
          generation_jobs: [], phone_mappings: [], ufdr_submissions: [],
          all_jobs_submitted: true,
        }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders StoryOutput", async () => {
    const { StoryOutput } = await import("../generation/step-outputs/StoryOutput");
    const { container } = render(
      <StoryOutput
        data={{
          original_description: "test",
          expanded_narrative: "expanded",
          key_themes: ["theme"],
          setting: "NYC 2024",
          generated_at: "2024-01-01",
        }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders SubmitJobOutput", async () => {
    const { SubmitJobOutput } = await import("../generation/step-outputs/SubmitJobOutput");
    const { container } = render(
      <SubmitJobOutput isSubmitted={false} />
    );
    expect(container).toBeTruthy();
  });
});

describe("Generation - Panel Smoke Tests", () => {
  it("renders GenerationPanel", async () => {
    const { GenerationPanel } = await import("../generation/GenerationPanel");
    const { container } = render(<GenerationPanel />);
    expect(container).toBeTruthy();
  });

  it("renders CountdownTimer", async () => {
    const { CountdownTimer } = await import("../generation/CountdownTimer");
    const { container } = render(
      <CountdownTimer seconds={15} onContinue={vi.fn()} onStop={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});
