import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useConversationStore } from "../conversationStore";
import { pipelineApi } from "../../api/pipelineApi";
import { ufdrApi } from "../../api/ufdrApi";
import type { StoryExpansion, AiGeneratedEntity, SocialGraph, TimelineEvent, SelectedPhone, JobGenerationResult } from "../../types/pipeline";

vi.mock("../../api/pipelineApi", () => ({
  pipelineApi: {
    expandStory: vi.fn(),
    extractEntities: vi.fn(),
    generateSocialGraph: vi.fn(),
    generateTimeline: vi.fn(),
    selectPhones: vi.fn(),
    generateStories: vi.fn(),
  },
}));

vi.mock("../../api/ufdrApi", () => ({
  ufdrApi: {
    submitJob: vi.fn(),
    pollJobStatuses: vi.fn(),
    isTerminalStatus: vi.fn(),
    isSuccessStatus: vi.fn(),
  },
}));

const mockStoryExpansion: StoryExpansion = {
  original_prompt: "test story",
  expanded_narrative: "expanded test story",
  key_themes: ["theme1"],
  setting: { location: "NYC", time_period: "2024" },
  characters: [],
};

const mockEntities: AiGeneratedEntity[] = [
  { name: "John", role: "suspect", phone_numbers: ["+1234"], email_addresses: [], description: "desc" },
];

const mockSocialGraph: SocialGraph = {
  relationships: [{ source: "John", target: "Jane", type: "friend", description: "friends" }],
};

const mockTimeline: TimelineEvent[] = [
  { timestamp: "2024-01-01T10:00:00Z", description: "Event 1", participants: ["John"], event_type: "call" },
];

const mockPhones: SelectedPhone[] = [
  { entity_name: "John", phone_number: "+1234", role: "suspect", device_model: "iPhone", os: "ios" },
];

const mockJobResult: JobGenerationResult = {
  total_stories_generated: 5,
  total_jobs_created: 1,
  generation_jobs: [{ job_id: "job-1", name: "Job 1", status: "Draft", tasks: [], entities: [], stories: { directed: true, multigraph: false, graph: {}, nodes: [], edges: [] }, custom_events: [], context: null, device_info: [], owner_entity: null }],
  phone_mappings: [{ phone: { entity_name: "John", phone_number: "+1234", role: "suspect", device_model: "iPhone", os: "ios" }, job_index: 0 }],
};

describe("conversationStore", () => {
  beforeEach(() => {
    useConversationStore.getState().resetConversation();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("has correct defaults", () => {
      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.initialPrompt).toBe("");
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.editingStep).toBeNull();
    });
  });

  describe("startConversation", () => {
    it("sets conversation started and adds user message", () => {
      useConversationStore.getState().startConversation("Hello world");

      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(true);
      expect(state.initialPrompt).toBe("Hello world");
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe("user");
      expect(state.messages[0].content).toBe("Hello world");
      expect(state.messages[0].id).toBeTruthy();
      expect(state.messages[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe("addMessage", () => {
    it("adds assistant message with auto-generated id and timestamp", () => {
      useConversationStore.getState().addMessage({
        role: "assistant",
        content: "Hi there",
        stepContext: "story-expansion",
      });

      const state = useConversationStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe("assistant");
      expect(state.messages[0].content).toBe("Hi there");
      expect(state.messages[0].stepContext).toBe("story-expansion");
    });
  });

  describe("setLoading", () => {
    it("toggles loading state", () => {
      useConversationStore.getState().setLoading(true);
      expect(useConversationStore.getState().isLoading).toBe(true);

      useConversationStore.getState().setLoading(false);
      expect(useConversationStore.getState().isLoading).toBe(false);
    });
  });

  describe("startGeneration", () => {
    it("sets generating state and story-expansion in-progress", () => {
      useConversationStore.getState().startGeneration();

      const state = useConversationStore.getState();
      expect(state.isGenerating).toBe(true);
      expect(state.generationProgress.currentStep).toBe("story-expansion");
      expect(state.generationProgress.steps["story-expansion"]).toBe("in-progress");
    });
  });

  describe("updateGenerationStep", () => {
    it("updates step status", () => {
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      expect(useConversationStore.getState().generationProgress.steps["story-expansion"]).toBe("completed");
    });
  });

  describe("setCurrentStep", () => {
    it("sets current step and marks in-progress", () => {
      useConversationStore.getState().setCurrentStep("entity-extraction");

      const state = useConversationStore.getState();
      expect(state.generationProgress.currentStep).toBe("entity-extraction");
      expect(state.generationProgress.steps["entity-extraction"]).toBe("in-progress");
    });

    it("sets null without error", () => {
      useConversationStore.getState().setCurrentStep(null);
      expect(useConversationStore.getState().generationProgress.currentStep).toBeNull();
    });
  });

  describe("setStepData", () => {
    it("sets step data by key", () => {
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      expect(useConversationStore.getState().generationProgress.stepData.storyExpansion).toEqual(mockStoryExpansion);
    });
  });

  describe("toggleStepExpanded", () => {
    it("toggles step expansion", () => {
      expect(useConversationStore.getState().generationProgress.expandedSteps["story-expansion"]).toBe(false);

      useConversationStore.getState().toggleStepExpanded("story-expansion");
      expect(useConversationStore.getState().generationProgress.expandedSteps["story-expansion"]).toBe(true);

      useConversationStore.getState().toggleStepExpanded("story-expansion");
      expect(useConversationStore.getState().generationProgress.expandedSteps["story-expansion"]).toBe(false);
    });
  });

  describe("auto-continue actions", () => {
    it("startAutoContinue sets timer state", () => {
      useConversationStore.getState().startAutoContinue("story-expansion");

      const state = useConversationStore.getState();
      expect(state.autoContinue.isActive).toBe(true);
      expect(state.autoContinue.remainingSeconds).toBe(15);
      expect(state.autoContinue.stepKey).toBe("story-expansion");
    });

    it("stopAutoContinue resets timer", () => {
      useConversationStore.getState().startAutoContinue("story-expansion");
      useConversationStore.getState().stopAutoContinue();

      const state = useConversationStore.getState();
      expect(state.autoContinue.isActive).toBe(false);
      expect(state.autoContinue.stepKey).toBeNull();
    });

    it("tickAutoContinue decrements seconds", () => {
      useConversationStore.getState().startAutoContinue("story-expansion");
      useConversationStore.getState().tickAutoContinue();

      expect(useConversationStore.getState().autoContinue.remainingSeconds).toBe(14);
    });

    it("tickAutoContinue does nothing when not active", () => {
      useConversationStore.getState().tickAutoContinue();
      expect(useConversationStore.getState().autoContinue.remainingSeconds).toBe(15);
    });

    it("tickAutoContinue triggers continueToNextStep when reaching 0", async () => {
      vi.mocked(pipelineApi.extractEntities).mockResolvedValue(mockEntities);

      // Set up state with completed story-expansion
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      useConversationStore.getState().startAutoContinue("story-expansion");

      // Set remaining to 1 so next tick triggers
      const store = useConversationStore.getState();
      // Manually set to 1
      useConversationStore.setState((s) => {
        s.autoContinue.remainingSeconds = 1;
      });

      useConversationStore.getState().tickAutoContinue();

      // Should have triggered continueToNextStep
      // The auto-continue should be stopped
      expect(useConversationStore.getState().autoContinue.isActive).toBe(false);
    });
  });

  describe("runPipeline", () => {
    it("runs story expansion step successfully", async () => {
      vi.mocked(pipelineApi.expandStory).mockResolvedValue(mockStoryExpansion);

      useConversationStore.getState().startConversation("test story");
      await useConversationStore.getState().runPipeline();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.storyExpansion).toEqual(mockStoryExpansion);
      expect(state.generationProgress.steps["story-expansion"]).toBe("completed");
      expect(state.autoContinue.isActive).toBe(true);
      expect(state.autoContinue.stepKey).toBe("story-expansion");
    });

    it("handles pipeline error", async () => {
      vi.mocked(pipelineApi.expandStory).mockRejectedValue(new Error("Pipeline error"));

      useConversationStore.getState().startConversation("test story");
      await useConversationStore.getState().runPipeline();

      const state = useConversationStore.getState();
      expect(state.error).toBe("Pipeline error");
      expect(state.generationProgress.steps["story-expansion"]).toBe("error");
    });

    it("handles non-Error pipeline failure", async () => {
      vi.mocked(pipelineApi.expandStory).mockRejectedValue("string error");

      useConversationStore.getState().startConversation("test");
      await useConversationStore.getState().runPipeline();

      const state = useConversationStore.getState();
      expect(state.error).toBe("Pipeline failed");
    });
  });

  describe("continueToNextStep", () => {
    it("does nothing without current step", async () => {
      await useConversationStore.getState().continueToNextStep();
      // No error should occur
    });

    it("completes pipeline when at last step", async () => {
      useConversationStore.getState().startAutoContinue("submit-job");
      useConversationStore.getState().setCurrentStep("submit-job");

      // Mock the continueToNextStep - when no next step, pipeline should complete
      // We need to set autoContinue.stepKey to a step that has no next
      // Actually getNextStep will return null for submit-job
      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.isGenerating).toBe(false);
    });

    it("runs entity-extraction step", async () => {
      vi.mocked(pipelineApi.extractEntities).mockResolvedValue(mockEntities);

      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setCurrentStep("story-expansion");
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      useConversationStore.getState().startAutoContinue("story-expansion");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.entities).toEqual(mockEntities);
      expect(state.generationProgress.steps["entity-extraction"]).toBe("completed");
    });

    it("runs social-graph step", async () => {
      vi.mocked(pipelineApi.generateSocialGraph).mockResolvedValue(mockSocialGraph);

      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setCurrentStep("entity-extraction");
      useConversationStore.getState().updateGenerationStep("entity-extraction", "completed");
      useConversationStore.getState().startAutoContinue("entity-extraction");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.socialGraph).toEqual(mockSocialGraph);
      expect(state.generationProgress.steps["social-graph"]).toBe("completed");
    });

    it("runs timeline step", async () => {
      vi.mocked(pipelineApi.generateTimeline).mockResolvedValue(mockTimeline);

      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setStepData("socialGraph", mockSocialGraph);
      useConversationStore.getState().setCurrentStep("social-graph");
      useConversationStore.getState().updateGenerationStep("social-graph", "completed");
      useConversationStore.getState().startAutoContinue("social-graph");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.timeline).toEqual(mockTimeline);
      expect(state.generationProgress.steps["timeline"]).toBe("completed");
    });

    it("runs phone-selection step", async () => {
      vi.mocked(pipelineApi.selectPhones).mockResolvedValue(mockPhones);

      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setStepData("timeline", mockTimeline);
      useConversationStore.getState().setStepData("socialGraph", mockSocialGraph);
      useConversationStore.getState().setCurrentStep("timeline");
      useConversationStore.getState().updateGenerationStep("timeline", "completed");
      useConversationStore.getState().startAutoContinue("timeline");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.selectedPhones).toEqual(mockPhones);
      expect(state.generationProgress.steps["phone-selection"]).toBe("completed");
    });

    it("runs story-generation step", async () => {
      vi.mocked(pipelineApi.generateStories).mockResolvedValue(mockJobResult);

      useConversationStore.getState().setStepData("selectedPhones", mockPhones);
      useConversationStore.getState().setStepData("timeline", mockTimeline);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setCurrentStep("phone-selection");
      useConversationStore.getState().updateGenerationStep("phone-selection", "completed");
      useConversationStore.getState().startAutoContinue("phone-selection");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.jobGenerationResult).toEqual(mockJobResult);
      expect(state.generationProgress.steps["story-generation"]).toBe("completed");
    });

    it("runs submit-job step with successful submission", async () => {
      vi.mocked(ufdrApi.submitJob).mockResolvedValue({
        job_id: "job-1",
        phone_entity_name: "John",
        status: "Pending",
        submitted_at: new Date(),
      });
      vi.mocked(ufdrApi.pollJobStatuses).mockResolvedValue(undefined);
      vi.mocked(ufdrApi.isTerminalStatus).mockReturnValue(true);
      vi.mocked(ufdrApi.isSuccessStatus).mockReturnValue(true);

      useConversationStore.getState().setStepData("jobGenerationResult", mockJobResult);
      useConversationStore.getState().setCurrentStep("story-generation");
      useConversationStore.getState().updateGenerationStep("story-generation", "completed");
      useConversationStore.getState().startAutoContinue("story-generation");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.jobSubmitted).toBe(true);
      expect(state.generationProgress.steps["submit-job"]).toBe("completed");
      expect(state.isGenerating).toBe(false);
    });

    it("handles submit-job step with failed submission", async () => {
      vi.mocked(ufdrApi.submitJob).mockRejectedValue(new Error("Submit fail"));
      vi.mocked(ufdrApi.isTerminalStatus).mockReturnValue(true);
      vi.mocked(ufdrApi.isSuccessStatus).mockReturnValue(false);

      useConversationStore.getState().setStepData("jobGenerationResult", mockJobResult);
      useConversationStore.getState().setCurrentStep("story-generation");
      useConversationStore.getState().updateGenerationStep("story-generation", "completed");
      useConversationStore.getState().startAutoContinue("story-generation");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.jobSubmitted).toBe(true);
    });

    it("handles missing story data for entity-extraction", async () => {
      // No storyExpansion data set
      useConversationStore.getState().setCurrentStep("story-expansion");
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      useConversationStore.getState().startAutoContinue("story-expansion");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.generationProgress.steps["entity-extraction"]).toBe("error");
    });

    it("handles missing data for social-graph", async () => {
      useConversationStore.getState().setCurrentStep("entity-extraction");
      useConversationStore.getState().updateGenerationStep("entity-extraction", "completed");
      useConversationStore.getState().startAutoContinue("entity-extraction");

      await useConversationStore.getState().continueToNextStep();

      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles missing data for timeline", async () => {
      useConversationStore.getState().setCurrentStep("social-graph");
      useConversationStore.getState().updateGenerationStep("social-graph", "completed");
      useConversationStore.getState().startAutoContinue("social-graph");

      await useConversationStore.getState().continueToNextStep();

      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles missing data for phone-selection", async () => {
      useConversationStore.getState().setCurrentStep("timeline");
      useConversationStore.getState().updateGenerationStep("timeline", "completed");
      useConversationStore.getState().startAutoContinue("timeline");

      await useConversationStore.getState().continueToNextStep();

      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles missing data for story-generation", async () => {
      useConversationStore.getState().setCurrentStep("phone-selection");
      useConversationStore.getState().updateGenerationStep("phone-selection", "completed");
      useConversationStore.getState().startAutoContinue("phone-selection");

      await useConversationStore.getState().continueToNextStep();

      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles missing data for submit-job", async () => {
      useConversationStore.getState().setCurrentStep("story-generation");
      useConversationStore.getState().updateGenerationStep("story-generation", "completed");
      useConversationStore.getState().startAutoContinue("story-generation");

      await useConversationStore.getState().continueToNextStep();

      expect(useConversationStore.getState().error).toBeTruthy();
    });
  });

  describe("retryStep", () => {
    it("retries story-expansion", async () => {
      vi.mocked(pipelineApi.expandStory).mockResolvedValue(mockStoryExpansion);

      useConversationStore.getState().startConversation("test");
      await useConversationStore.getState().retryStep("story-expansion");

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.storyExpansion).toEqual(mockStoryExpansion);
      expect(state.generationProgress.steps["story-expansion"]).toBe("completed");
    });

    it("retries entity-extraction", async () => {
      vi.mocked(pipelineApi.extractEntities).mockResolvedValue(mockEntities);
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);

      await useConversationStore.getState().retryStep("entity-extraction");

      expect(useConversationStore.getState().generationProgress.stepData.entities).toEqual(mockEntities);
    });

    it("retries social-graph", async () => {
      vi.mocked(pipelineApi.generateSocialGraph).mockResolvedValue(mockSocialGraph);
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setStepData("entities", mockEntities);

      await useConversationStore.getState().retryStep("social-graph");

      expect(useConversationStore.getState().generationProgress.stepData.socialGraph).toEqual(mockSocialGraph);
    });

    it("retries timeline", async () => {
      vi.mocked(pipelineApi.generateTimeline).mockResolvedValue(mockTimeline);
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setStepData("socialGraph", mockSocialGraph);

      await useConversationStore.getState().retryStep("timeline");

      expect(useConversationStore.getState().generationProgress.stepData.timeline).toEqual(mockTimeline);
    });

    it("retries phone-selection", async () => {
      vi.mocked(pipelineApi.selectPhones).mockResolvedValue(mockPhones);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setStepData("timeline", mockTimeline);
      useConversationStore.getState().setStepData("socialGraph", mockSocialGraph);

      await useConversationStore.getState().retryStep("phone-selection");

      expect(useConversationStore.getState().generationProgress.stepData.selectedPhones).toEqual(mockPhones);
    });

    it("retries story-generation", async () => {
      vi.mocked(pipelineApi.generateStories).mockResolvedValue(mockJobResult);
      useConversationStore.getState().setStepData("selectedPhones", mockPhones);
      useConversationStore.getState().setStepData("timeline", mockTimeline);
      useConversationStore.getState().setStepData("entities", mockEntities);

      await useConversationStore.getState().retryStep("story-generation");

      expect(useConversationStore.getState().generationProgress.stepData.jobGenerationResult).toEqual(mockJobResult);
    });

    it("retries submit-job", async () => {
      vi.mocked(ufdrApi.submitJob).mockResolvedValue({
        job_id: "job-1",
        phone_entity_name: "John",
        status: "Pending",
        submitted_at: new Date(),
      });
      vi.mocked(ufdrApi.pollJobStatuses).mockResolvedValue(undefined);
      vi.mocked(ufdrApi.isTerminalStatus).mockReturnValue(true);
      vi.mocked(ufdrApi.isSuccessStatus).mockReturnValue(true);

      useConversationStore.getState().setStepData("jobGenerationResult", mockJobResult);

      await useConversationStore.getState().retryStep("submit-job");

      expect(useConversationStore.getState().generationProgress.steps["submit-job"]).toBe("completed");
    });

    it("handles retry error", async () => {
      vi.mocked(pipelineApi.expandStory).mockRejectedValue(new Error("Retry fail"));
      useConversationStore.getState().startConversation("test");

      await useConversationStore.getState().retryStep("story-expansion");

      const state = useConversationStore.getState();
      expect(state.error).toBe("Retry fail");
      expect(state.generationProgress.steps["story-expansion"]).toBe("error");
    });

    it("handles retry non-Error failure", async () => {
      vi.mocked(pipelineApi.expandStory).mockRejectedValue("string error");
      useConversationStore.getState().startConversation("test");

      await useConversationStore.getState().retryStep("story-expansion");

      expect(useConversationStore.getState().error).toBe("Step failed");
    });

    it("handles retry entity-extraction missing data", async () => {
      await useConversationStore.getState().retryStep("entity-extraction");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry social-graph missing data", async () => {
      await useConversationStore.getState().retryStep("social-graph");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry timeline missing data", async () => {
      await useConversationStore.getState().retryStep("timeline");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry phone-selection missing data", async () => {
      await useConversationStore.getState().retryStep("phone-selection");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry story-generation missing data", async () => {
      await useConversationStore.getState().retryStep("story-generation");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry submit-job missing data", async () => {
      await useConversationStore.getState().retryStep("submit-job");
      expect(useConversationStore.getState().error).toBeTruthy();
    });

    it("handles retry submit-job with empty generation_jobs", async () => {
      useConversationStore.getState().setStepData("jobGenerationResult", {
        ...mockJobResult,
        generation_jobs: [],
      });

      await useConversationStore.getState().retryStep("submit-job");

      expect(useConversationStore.getState().error).toBeTruthy();
    });
  });

  describe("edit actions", () => {
    it("startEditing sets editing step and copies data", () => {
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().startEditing("story-expansion");

      const state = useConversationStore.getState();
      expect(state.editingStep).toBe("story-expansion");
      expect(state.autoContinue.isActive).toBe(false);
      expect(state.editedData.storyExpansion).toEqual(mockStoryExpansion);
    });

    it("cancelEditing clears editing state", () => {
      useConversationStore.getState().startEditing("story-expansion");
      useConversationStore.getState().cancelEditing();

      const state = useConversationStore.getState();
      expect(state.editingStep).toBeNull();
      expect(state.editedData).toEqual({});
    });

    it("cancelEditing resumes auto-continue if step was completed", () => {
      useConversationStore.getState().setCurrentStep("story-expansion");
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      useConversationStore.getState().startEditing("story-expansion");
      useConversationStore.getState().cancelEditing();

      const state = useConversationStore.getState();
      expect(state.autoContinue.isActive).toBe(true);
      expect(state.autoContinue.stepKey).toBe("story-expansion");
    });

    it("saveEdits applies edited data and resets subsequent steps", () => {
      // Set up pipeline data
      useConversationStore.getState().setStepData("storyExpansion", mockStoryExpansion);
      useConversationStore.getState().setStepData("entities", mockEntities);
      useConversationStore.getState().setStepData("socialGraph", mockSocialGraph);
      useConversationStore.getState().updateGenerationStep("story-expansion", "completed");
      useConversationStore.getState().updateGenerationStep("entity-extraction", "completed");
      useConversationStore.getState().updateGenerationStep("social-graph", "completed");

      // Edit story-expansion
      useConversationStore.getState().startEditing("story-expansion");
      const editedExpansion = { ...mockStoryExpansion, expanded_narrative: "edited" };
      useConversationStore.getState().updateEditedData("storyExpansion", editedExpansion);
      useConversationStore.getState().saveEdits();

      const state = useConversationStore.getState();
      expect(state.editingStep).toBeNull();
      expect(state.generationProgress.stepData.storyExpansion?.expanded_narrative).toBe("edited");
      // Subsequent steps should be reset to pending
      expect(state.generationProgress.steps["entity-extraction"]).toBe("pending");
      expect(state.generationProgress.steps["social-graph"]).toBe("pending");
      // Data for subsequent steps should be cleared
      expect(state.generationProgress.stepData.entities).toBeUndefined();
      expect(state.generationProgress.stepData.socialGraph).toBeUndefined();
      // Auto-continue should start
      expect(state.autoContinue.isActive).toBe(true);
      expect(state.autoContinue.stepKey).toBe("story-expansion");
    });

    it("updateEditedData updates specific data key", () => {
      useConversationStore.getState().startEditing("story-expansion");
      useConversationStore.getState().updateEditedData("storyExpansion", mockStoryExpansion);

      expect(useConversationStore.getState().editedData.storyExpansion).toEqual(mockStoryExpansion);
    });
  });

  describe("resetConversation", () => {
    it("resets all state to initial values", () => {
      // Set up various state
      useConversationStore.getState().startConversation("test");
      useConversationStore.getState().setLoading(true);
      useConversationStore.getState().setError("some error");
      useConversationStore.getState().startGeneration();

      useConversationStore.getState().resetConversation();

      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.initialPrompt).toBe("");
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.editingStep).toBeNull();
      expect(state.editedData).toEqual({});
    });
  });

  describe("setError", () => {
    it("sets and clears error", () => {
      useConversationStore.getState().setError("test error");
      expect(useConversationStore.getState().error).toBe("test error");

      useConversationStore.getState().setError(null);
      expect(useConversationStore.getState().error).toBeNull();
    });
  });

  describe("submit-job with partial success", () => {
    it("handles mixed success/failure submissions", async () => {
      const multiJobResult: JobGenerationResult = {
        ...mockJobResult,
        generation_jobs: [
          mockJobResult.generation_jobs[0],
          { ...mockJobResult.generation_jobs[0], job_id: "job-2" },
        ],
        phone_mappings: [
          mockJobResult.phone_mappings[0],
          { ...mockJobResult.phone_mappings[0], job_index: 1 },
        ],
      };

      vi.mocked(ufdrApi.submitJob)
        .mockResolvedValueOnce({ job_id: "job-1", phone_entity_name: "John", status: "Pending", submitted_at: new Date() })
        .mockRejectedValueOnce(new Error("Submit fail"));
      vi.mocked(ufdrApi.pollJobStatuses).mockResolvedValue(undefined);
      vi.mocked(ufdrApi.isTerminalStatus).mockReturnValue(true);
      vi.mocked(ufdrApi.isSuccessStatus).mockImplementation((status) => status === "Pending");

      useConversationStore.getState().setStepData("jobGenerationResult", multiJobResult);
      useConversationStore.getState().setCurrentStep("story-generation");
      useConversationStore.getState().updateGenerationStep("story-generation", "completed");
      useConversationStore.getState().startAutoContinue("story-generation");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.submittedJobs).toHaveLength(2);
      expect(state.generationProgress.stepData.jobSubmitted).toBe(true);
    });
  });

  describe("submit-job polling timeout scenario", () => {
    it("handles polling timeout", async () => {
      vi.mocked(ufdrApi.submitJob).mockResolvedValue({
        job_id: "job-1",
        phone_entity_name: "John",
        status: "Pending",
        submitted_at: new Date(),
      });
      vi.mocked(ufdrApi.pollJobStatuses).mockResolvedValue(undefined);
      vi.mocked(ufdrApi.isTerminalStatus).mockReturnValue(false); // Not terminal = timed out
      vi.mocked(ufdrApi.isSuccessStatus).mockReturnValue(false);

      useConversationStore.getState().setStepData("jobGenerationResult", mockJobResult);
      useConversationStore.getState().setCurrentStep("story-generation");
      useConversationStore.getState().updateGenerationStep("story-generation", "completed");
      useConversationStore.getState().startAutoContinue("story-generation");

      await useConversationStore.getState().continueToNextStep();

      const state = useConversationStore.getState();
      expect(state.generationProgress.stepData.jobSubmitted).toBe(true);
      // Messages should include timeout message
      const timeoutMsg = state.messages.find((m) => m.content.includes("timed out"));
      expect(timeoutMsg).toBeTruthy();
    });
  });
});
