import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { pipelineApi } from "../api/pipelineApi.ts";
import { ufdrApi } from "../api/ufdrApi.ts";
import {
  AiGeneratedEntity,
  JobGenerationResult,
  PIPELINE_STEPS,
  PipelineStepKey,
  SelectedPhone,
  SocialGraph,
  StoryExpansion,
  SubmittedJob,
  TimelineEvent,
} from "../types/pipeline.ts";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  stepContext?: PipelineStepKey;
}

// Re-export for backward compatibility
export type GenerationStep = PipelineStepKey;
export type StepStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "error"
  | "editing";

export interface StepData {
  storyExpansion?: StoryExpansion;
  entities?: AiGeneratedEntity[];
  socialGraph?: SocialGraph;
  timeline?: TimelineEvent[];
  selectedPhones?: SelectedPhone[];
  jobGenerationResult?: JobGenerationResult;
  jobSubmitted?: boolean;
  submittedJobs?: SubmittedJob[];
}

export interface GenerationProgress {
  currentStep: PipelineStepKey | null;
  steps: Record<PipelineStepKey, StepStatus>;
  stepData: StepData;
  expandedSteps: Record<PipelineStepKey, boolean>;
}

export interface AutoContinueState {
  isActive: boolean;
  remainingSeconds: number;
  stepKey: PipelineStepKey | null;
}

interface ConversationState {
  // Conversation state
  isConversationStarted: boolean;
  messages: Message[];
  isLoading: boolean;
  initialPrompt: string;

  // Generation state
  isGenerating: boolean;
  generationProgress: GenerationProgress;

  // Auto-continue timer state
  autoContinue: AutoContinueState;

  // Edit mode
  editingStep: PipelineStepKey | null;
  editedData: StepData;

  // Error state
  error: string | null;

  // Actions
  startConversation: (initialMessage: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  setLoading: (loading: boolean) => void;
  startGeneration: () => void;
  runPipeline: () => Promise<void>;
  updateGenerationStep: (step: PipelineStepKey, status: StepStatus) => void;
  setCurrentStep: (step: PipelineStepKey | null) => void;
  setStepData: <K extends keyof StepData>(key: K, data: StepData[K]) => void;
  toggleStepExpanded: (step: PipelineStepKey) => void;

  // Auto-continue actions
  startAutoContinue: (stepKey: PipelineStepKey) => void;
  stopAutoContinue: () => void;
  tickAutoContinue: () => void;
  continueToNextStep: () => Promise<void>;
  retryStep: (step: PipelineStepKey) => Promise<void>;

  // Edit actions
  startEditing: (step: PipelineStepKey) => void;
  cancelEditing: () => void;
  saveEdits: () => void;
  updateEditedData: <K extends keyof StepData>(
    key: K,
    data: StepData[K]
  ) => void;

  // Reset
  resetConversation: () => void;
  setError: (error: string | null) => void;
}

const initialStepsStatus: Record<PipelineStepKey, StepStatus> = {
  "story-expansion": "pending",
  "entity-extraction": "pending",
  "social-graph": "pending",
  timeline: "pending",
  "phone-selection": "pending",
  "story-generation": "pending",
  "submit-job": "pending",
};

const initialExpandedSteps: Record<PipelineStepKey, boolean> = {
  "story-expansion": false,
  "entity-extraction": false,
  "social-graph": false,
  timeline: false,
  "phone-selection": false,
  "story-generation": false,
  "submit-job": false,
};

const initialGenerationProgress: GenerationProgress = {
  currentStep: null,
  steps: { ...initialStepsStatus },
  stepData: {},
  expandedSteps: { ...initialExpandedSteps },
};

const initialAutoContinue: AutoContinueState = {
  isActive: false,
  remainingSeconds: 15,
  stepKey: null,
};

const getNextStep = (currentStep: PipelineStepKey): PipelineStepKey | null => {
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStep);
  if (currentIndex === -1 || currentIndex >= PIPELINE_STEPS.length - 1) {
    return null;
  }
  return PIPELINE_STEPS[currentIndex + 1].key;
};

export const useConversationStore = create<ConversationState>()(
  immer((set, get) => ({
    // Initial state
    isConversationStarted: false,
    messages: [],
    isLoading: false,
    initialPrompt: "",
    isGenerating: false,
    generationProgress: { ...initialGenerationProgress },
    autoContinue: { ...initialAutoContinue },
    editingStep: null,
    editedData: {},
    error: null,

    // Actions
    startConversation: (initialMessage: string) =>
      set((state) => {
        state.isConversationStarted = true;
        state.initialPrompt = initialMessage;
        state.messages.push({
          id: crypto.randomUUID(),
          role: "user",
          content: initialMessage,
          timestamp: new Date(),
        });
      }),

    addMessage: (message) =>
      set((state) => {
        state.messages.push({
          ...message,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        });
      }),

    setLoading: (loading: boolean) =>
      set((state) => {
        state.isLoading = loading;
      }),

    startGeneration: () =>
      set((state) => {
        state.isGenerating = true;
        state.generationProgress.currentStep = "story-expansion";
        state.generationProgress.steps["story-expansion"] = "in-progress";
      }),

    runPipeline: async () => {
      const state = get();
      const { initialPrompt } = state;

      // Start with story expansion
      set((s) => {
        s.isGenerating = true;
        s.generationProgress.currentStep = "story-expansion";
        s.generationProgress.steps["story-expansion"] = "in-progress";
        s.error = null;
      });

      // Add assistant message
      get().addMessage({
        role: "assistant",
        content:
          "Starting UFDR generation pipeline... Expanding your story description.",
      });

      try {
        // Step 1: Story Expansion
        const storyExpansion = await pipelineApi.expandStory(initialPrompt);
        set((s) => {
          s.generationProgress.stepData.storyExpansion = storyExpansion;
          s.generationProgress.steps["story-expansion"] = "completed";
        });

        get().addMessage({
          role: "assistant",
          content:
            "✅ Story expanded! You can review and edit, or wait 15 seconds to continue.",
          stepContext: "story-expansion",
        });

        get().startAutoContinue("story-expansion");
      } catch (error) {
        set((s) => {
          s.error = error instanceof Error ? error.message : "Pipeline failed";
          s.generationProgress.steps[s.generationProgress.currentStep!] =
            "error";
        });
        get().addMessage({
          role: "assistant",
          content: `❌ Error: ${
            error instanceof Error ? error.message : "Something went wrong"
          }`,
        });
      }
    },

    updateGenerationStep: (step: PipelineStepKey, status: StepStatus) =>
      set((state) => {
        state.generationProgress.steps[step] = status;
      }),

    setCurrentStep: (step: PipelineStepKey | null) =>
      set((state) => {
        state.generationProgress.currentStep = step;
        if (step) {
          state.generationProgress.steps[step] = "in-progress";
        }
      }),

    setStepData: <K extends keyof StepData>(key: K, data: StepData[K]) =>
      set((state) => {
        state.generationProgress.stepData[key] = data;
      }),

    toggleStepExpanded: (step: PipelineStepKey) =>
      set((state) => {
        state.generationProgress.expandedSteps[step] =
          !state.generationProgress.expandedSteps[step];
      }),

    // Auto-continue actions
    startAutoContinue: (stepKey: PipelineStepKey) =>
      set((state) => {
        state.autoContinue = {
          isActive: true,
          remainingSeconds: 15,
          stepKey,
        };
      }),

    stopAutoContinue: () =>
      set((state) => {
        state.autoContinue = {
          isActive: false,
          remainingSeconds: 15,
          stepKey: null,
        };
      }),

    tickAutoContinue: () => {
      const state = get();
      if (!state.autoContinue.isActive) return;

      if (state.autoContinue.remainingSeconds <= 1) {
        // Timer expired, continue to next step
        get().continueToNextStep();
      } else {
        set((s) => {
          s.autoContinue.remainingSeconds -= 1;
        });
      }
    },

    continueToNextStep: async () => {
      const state = get();
      const currentStep =
        state.autoContinue.stepKey || state.generationProgress.currentStep;

      if (!currentStep) return;

      // Stop auto-continue
      set((s) => {
        s.autoContinue = {
          isActive: false,
          remainingSeconds: 15,
          stepKey: null,
        };
      });

      const nextStep = getNextStep(currentStep);

      if (!nextStep) {
        // Pipeline complete
        set((s) => {
          s.isGenerating = false;
        });
        get().addMessage({
          role: "assistant",
          content:
            "🎉 UFDR generation pipeline complete! Your data is ready for review.",
        });
        return;
      }

      // Move to next step
      set((s) => {
        s.generationProgress.currentStep = nextStep;
        s.generationProgress.steps[nextStep] = "in-progress";
      });

      const stepLabel =
        PIPELINE_STEPS.find((s) => s.key === nextStep)?.label || nextStep;
      get().addMessage({
        role: "assistant",
        content: `Starting ${stepLabel}...`,
      });

      try {
        const { stepData } = get().generationProgress;

        switch (nextStep) {
          case "entity-extraction": {
            if (!stepData.storyExpansion) throw new Error("Missing story data");
            const entities = await pipelineApi.extractEntities(
              stepData.storyExpansion
            );
            set((s) => {
              s.generationProgress.stepData.entities = entities;
              s.generationProgress.steps["entity-extraction"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Found ${entities.length} entities! Review and edit, or wait to continue.`,
              stepContext: "entity-extraction",
            });
            get().startAutoContinue("entity-extraction");
            break;
          }
          case "social-graph": {
            if (!stepData.storyExpansion || !stepData.entities) {
              throw new Error("Missing required data");
            }
            const socialGraph = await pipelineApi.generateSocialGraph(
              stepData.storyExpansion,
              stepData.entities
            );
            set((s) => {
              s.generationProgress.stepData.socialGraph = socialGraph;
              s.generationProgress.steps["social-graph"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Social graph complete with ${socialGraph.relationships.length} relationships!`,
              stepContext: "social-graph",
            });
            get().startAutoContinue("social-graph");
            break;
          }
          case "timeline": {
            if (
              !stepData.storyExpansion ||
              !stepData.entities ||
              !stepData.socialGraph
            ) {
              throw new Error("Missing required data");
            }
            const timeline = await pipelineApi.generateTimeline(
              stepData.storyExpansion,
              stepData.entities,
              stepData.socialGraph
            );
            set((s) => {
              s.generationProgress.stepData.timeline = timeline;
              s.generationProgress.steps["timeline"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Generated ${timeline.length} timeline events!`,
              stepContext: "timeline",
            });
            get().startAutoContinue("timeline");
            break;
          }
          case "phone-selection": {
            if (
              !stepData.entities ||
              !stepData.timeline ||
              !stepData.socialGraph
            ) {
              throw new Error("Missing required data");
            }
            const phones = await pipelineApi.selectPhones(
              stepData.entities,
              stepData.timeline,
              stepData.socialGraph
            );
            set((s) => {
              s.generationProgress.stepData.selectedPhones = phones;
              s.generationProgress.steps["phone-selection"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Selected ${phones.length} phones for extraction. Review and edit, or wait to continue.`,
              stepContext: "phone-selection",
            });
            get().startAutoContinue("phone-selection");
            break;
          }
          case "story-generation": {
            if (
              !stepData.selectedPhones ||
              !stepData.timeline ||
              !stepData.entities
            ) {
              throw new Error("Missing required data");
            }
            const result = await pipelineApi.generateStories(
              stepData.selectedPhones,
              stepData.timeline,
              stepData.entities
            );
            set((s) => {
              s.generationProgress.stepData.jobGenerationResult = result;
              s.generationProgress.steps["story-generation"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Generated ${result.total_stories_generated} stories for ${result.total_jobs_created} jobs! Review and edit, or wait to continue.`,
              stepContext: "story-generation",
            });
            get().startAutoContinue("story-generation");
            break;
          }
          case "submit-job": {
            if (!stepData.jobGenerationResult) {
              throw new Error("Missing job generation result");
            }

            const { generation_jobs, phone_mappings } =
              stepData.jobGenerationResult;

            if (!generation_jobs || generation_jobs.length === 0) {
              throw new Error("No generation jobs to submit");
            }

            get().addMessage({
              role: "assistant",
              content: `📤 Submitting ${generation_jobs.length} jobs to UFDR...`,
              stepContext: "submit-job",
            });

            // Submit each job with a new UUID
            const submittedJobs: SubmittedJob[] = [];
            for (let i = 0; i < generation_jobs.length; i++) {
              const job = generation_jobs[i];
              const phoneMapping = phone_mappings[i];
              const phoneEntityName =
                phoneMapping?.phone?.entity_name || `Job ${i + 1}`;

              try {
                const submitted = await ufdrApi.submitJob(job, phoneEntityName);
                submittedJobs.push(submitted);
                get().addMessage({
                  role: "assistant",
                  content: `✅ Submitted job for ${phoneEntityName} (${submitted.job_id})`,
                  stepContext: "submit-job",
                });
              } catch (error) {
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error";
                submittedJobs.push({
                  job_id: job.job_id || "unknown",
                  phone_entity_name: phoneEntityName,
                  status: "Failed",
                  submitted_at: new Date(),
                });
                get().addMessage({
                  role: "assistant",
                  content: `❌ Failed to submit job for ${phoneEntityName}: ${errorMsg}`,
                  stepContext: "submit-job",
                });
              }
            }

            // Update state with submitted jobs
            set((s) => {
              s.generationProgress.stepData.submittedJobs = submittedJobs;
            });

            // Start polling for job statuses
            const successfulJobIds = submittedJobs
              .filter((j) => j.status === "Pending")
              .map((j) => j.job_id);

            if (successfulJobIds.length > 0) {
              get().addMessage({
                role: "assistant",
                content: `⏳ Polling ${successfulJobIds.length} jobs for completion...`,
                stepContext: "submit-job",
              });

              // Poll for job statuses
              await ufdrApi.pollJobStatuses(
                successfulJobIds,
                (statuses) => {
                  // Update submitted jobs with new statuses
                  set((s) => {
                    const jobs = s.generationProgress.stepData.submittedJobs;
                    if (jobs) {
                      jobs.forEach((job) => {
                        const newStatus = statuses.get(job.job_id);
                        if (newStatus) {
                          job.status = newStatus;
                        }
                      });
                    }
                  });
                },
                { pollIntervalMs: 5000, timeoutMs: 600000 }
              );
            }

            // Check final status
            const allJobs =
              get().generationProgress.stepData.submittedJobs || [];
            const allDone = allJobs.every((j) =>
              ufdrApi.isTerminalStatus(j.status)
            );
            const allSuccess = allJobs.every((j) =>
              ufdrApi.isSuccessStatus(j.status)
            );

            set((s) => {
              s.generationProgress.stepData.jobSubmitted = true;
              s.generationProgress.steps["submit-job"] = "completed";
              s.isGenerating = false;
            });

            if (allSuccess) {
              get().addMessage({
                role: "assistant",
                content: `🎉 All ${allJobs.length} jobs completed successfully! Pipeline complete.`,
                stepContext: "submit-job",
              });
            } else if (allDone) {
              const failedCount = allJobs.filter(
                (j) => !ufdrApi.isSuccessStatus(j.status)
              ).length;
              get().addMessage({
                role: "assistant",
                content: `⚠️ Pipeline complete. ${
                  allJobs.length - failedCount
                }/${allJobs.length} jobs succeeded.`,
                stepContext: "submit-job",
              });
            } else {
              get().addMessage({
                role: "assistant",
                content: `⏱️ Jobs submitted and polling timed out. Check job status manually.`,
                stepContext: "submit-job",
              });
            }
            break;
          }
        }
      } catch (error) {
        set((s) => {
          s.error = error instanceof Error ? error.message : "Step failed";
          if (s.generationProgress.currentStep) {
            s.generationProgress.steps[s.generationProgress.currentStep] =
              "error";
          }
        });
        get().addMessage({
          role: "assistant",
          content: `❌ Error: ${
            error instanceof Error ? error.message : "Something went wrong"
          }`,
        });
      }
    },

    retryStep: async (step: PipelineStepKey) => {
      // Reset the step status and clear error
      set((s) => {
        s.error = null;
        s.generationProgress.steps[step] = "in-progress";
        s.generationProgress.currentStep = step;
        s.isGenerating = true;
        s.autoContinue = {
          isActive: false,
          remainingSeconds: 15,
          stepKey: null,
        };
      });

      const stepLabel =
        PIPELINE_STEPS.find((s) => s.key === step)?.label || step;
      get().addMessage({
        role: "assistant",
        content: `🔄 Retrying ${stepLabel}...`,
        stepContext: step,
      });

      try {
        const { stepData } = get().generationProgress;

        switch (step) {
          case "story-expansion": {
            const storyExpansion = await pipelineApi.expandStory(
              get().initialPrompt
            );
            set((s) => {
              s.generationProgress.stepData.storyExpansion = storyExpansion;
              s.generationProgress.steps["story-expansion"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Story expanded! Review and edit, or wait to continue.`,
              stepContext: "story-expansion",
            });
            get().startAutoContinue("story-expansion");
            break;
          }
          case "entity-extraction": {
            if (!stepData.storyExpansion) throw new Error("Missing story data");
            const entities = await pipelineApi.extractEntities(
              stepData.storyExpansion
            );
            set((s) => {
              s.generationProgress.stepData.entities = entities;
              s.generationProgress.steps["entity-extraction"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Found ${entities.length} entities! Review and edit, or wait to continue.`,
              stepContext: "entity-extraction",
            });
            get().startAutoContinue("entity-extraction");
            break;
          }
          case "social-graph": {
            if (!stepData.storyExpansion || !stepData.entities) {
              throw new Error("Missing required data");
            }
            const socialGraph = await pipelineApi.generateSocialGraph(
              stepData.storyExpansion,
              stepData.entities
            );
            set((s) => {
              s.generationProgress.stepData.socialGraph = socialGraph;
              s.generationProgress.steps["social-graph"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Social graph complete with ${socialGraph.relationships.length} relationships!`,
              stepContext: "social-graph",
            });
            get().startAutoContinue("social-graph");
            break;
          }
          case "timeline": {
            if (
              !stepData.storyExpansion ||
              !stepData.entities ||
              !stepData.socialGraph
            ) {
              throw new Error("Missing required data");
            }
            const timeline = await pipelineApi.generateTimeline(
              stepData.storyExpansion,
              stepData.entities,
              stepData.socialGraph
            );
            set((s) => {
              s.generationProgress.stepData.timeline = timeline;
              s.generationProgress.steps["timeline"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Generated ${timeline.length} timeline events!`,
              stepContext: "timeline",
            });
            get().startAutoContinue("timeline");
            break;
          }
          case "phone-selection": {
            if (
              !stepData.entities ||
              !stepData.timeline ||
              !stepData.socialGraph
            ) {
              throw new Error("Missing required data");
            }
            const phones = await pipelineApi.selectPhones(
              stepData.entities,
              stepData.timeline,
              stepData.socialGraph
            );
            set((s) => {
              s.generationProgress.stepData.selectedPhones = phones;
              s.generationProgress.steps["phone-selection"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Selected ${phones.length} phones for extraction. Review and edit, or wait to continue.`,
              stepContext: "phone-selection",
            });
            get().startAutoContinue("phone-selection");
            break;
          }
          case "story-generation": {
            if (
              !stepData.selectedPhones ||
              !stepData.timeline ||
              !stepData.entities
            ) {
              throw new Error("Missing required data");
            }
            const result = await pipelineApi.generateStories(
              stepData.selectedPhones,
              stepData.timeline,
              stepData.entities
            );
            set((s) => {
              s.generationProgress.stepData.jobGenerationResult = result;
              s.generationProgress.steps["story-generation"] = "completed";
            });
            get().addMessage({
              role: "assistant",
              content: `✅ Generated ${result.total_stories_generated} stories for ${result.total_jobs_created} jobs! Review and edit, or wait to continue.`,
              stepContext: "story-generation",
            });
            get().startAutoContinue("story-generation");
            break;
          }
          case "submit-job": {
            if (!stepData.jobGenerationResult) {
              throw new Error("Missing job generation result");
            }

            const { generation_jobs, phone_mappings } =
              stepData.jobGenerationResult;

            if (!generation_jobs || generation_jobs.length === 0) {
              throw new Error("No generation jobs to submit");
            }

            get().addMessage({
              role: "assistant",
              content: `📤 Submitting ${generation_jobs.length} jobs to UFDR...`,
              stepContext: "submit-job",
            });

            // Submit each job with a new UUID
            const submittedJobs: SubmittedJob[] = [];
            for (let i = 0; i < generation_jobs.length; i++) {
              const job = generation_jobs[i];
              const phoneMapping = phone_mappings[i];
              const phoneEntityName =
                phoneMapping?.phone?.entity_name || `Job ${i + 1}`;

              try {
                const submitted = await ufdrApi.submitJob(job, phoneEntityName);
                submittedJobs.push(submitted);
                get().addMessage({
                  role: "assistant",
                  content: `✅ Submitted job for ${phoneEntityName} (${submitted.job_id})`,
                  stepContext: "submit-job",
                });
              } catch (error) {
                const errorMsg =
                  error instanceof Error ? error.message : "Unknown error";
                submittedJobs.push({
                  job_id: job.job_id || "unknown",
                  phone_entity_name: phoneEntityName,
                  status: "Failed",
                  submitted_at: new Date(),
                });
                get().addMessage({
                  role: "assistant",
                  content: `❌ Failed to submit job for ${phoneEntityName}: ${errorMsg}`,
                  stepContext: "submit-job",
                });
              }
            }

            // Update state with submitted jobs
            set((s) => {
              s.generationProgress.stepData.submittedJobs = submittedJobs;
            });

            // Start polling for job statuses
            const successfulJobIds = submittedJobs
              .filter((j) => j.status === "Pending")
              .map((j) => j.job_id);

            if (successfulJobIds.length > 0) {
              get().addMessage({
                role: "assistant",
                content: `⏳ Polling ${successfulJobIds.length} jobs for completion...`,
                stepContext: "submit-job",
              });

              // Poll for job statuses
              await ufdrApi.pollJobStatuses(
                successfulJobIds,
                (statuses) => {
                  // Update submitted jobs with new statuses
                  set((s) => {
                    const jobs = s.generationProgress.stepData.submittedJobs;
                    if (jobs) {
                      jobs.forEach((job) => {
                        const newStatus = statuses.get(job.job_id);
                        if (newStatus) {
                          job.status = newStatus;
                        }
                      });
                    }
                  });
                },
                { pollIntervalMs: 5000, timeoutMs: 600000 }
              );
            }

            // Check final status
            const allJobs =
              get().generationProgress.stepData.submittedJobs || [];
            const allDone = allJobs.every((j) =>
              ufdrApi.isTerminalStatus(j.status)
            );
            const allSuccess = allJobs.every((j) =>
              ufdrApi.isSuccessStatus(j.status)
            );

            set((s) => {
              s.generationProgress.stepData.jobSubmitted = true;
              s.generationProgress.steps["submit-job"] = "completed";
              s.isGenerating = false;
            });

            if (allSuccess) {
              get().addMessage({
                role: "assistant",
                content: `🎉 All ${allJobs.length} jobs completed successfully! Pipeline complete.`,
                stepContext: "submit-job",
              });
            } else if (allDone) {
              const failedCount = allJobs.filter(
                (j) => !ufdrApi.isSuccessStatus(j.status)
              ).length;
              get().addMessage({
                role: "assistant",
                content: `⚠️ Pipeline complete. ${
                  allJobs.length - failedCount
                }/${allJobs.length} jobs succeeded.`,
                stepContext: "submit-job",
              });
            } else {
              get().addMessage({
                role: "assistant",
                content: `⏱️ Jobs submitted and polling timed out. Check job status manually.`,
                stepContext: "submit-job",
              });
            }
            break;
          }
        }
      } catch (error) {
        set((s) => {
          s.error = error instanceof Error ? error.message : "Step failed";
          s.generationProgress.steps[step] = "error";
        });
        get().addMessage({
          role: "assistant",
          content: `❌ Error: ${
            error instanceof Error ? error.message : "Something went wrong"
          }`,
        });
      }
    },

    // Edit actions
    startEditing: (step: PipelineStepKey) =>
      set((state) => {
        state.editingStep = step;
        state.autoContinue.isActive = false;
        // Copy current data to edited data
        state.editedData = { ...state.generationProgress.stepData };
      }),

    cancelEditing: () =>
      set((state) => {
        state.editingStep = null;
        state.editedData = {};
        // Resume auto-continue if step was completed
        const currentStep = state.generationProgress.currentStep;
        if (
          currentStep &&
          state.generationProgress.steps[currentStep] === "completed"
        ) {
          state.autoContinue = {
            isActive: true,
            remainingSeconds: 15,
            stepKey: currentStep,
          };
        }
      }),

    saveEdits: () =>
      set((state) => {
        const editedStep = state.editingStep;

        // Apply edited data
        state.generationProgress.stepData = { ...state.editedData };
        state.editingStep = null;
        state.editedData = {};

        if (editedStep) {
          // Find the index of the edited step
          const editedStepIndex = PIPELINE_STEPS.findIndex(
            (s) => s.key === editedStep
          );

          // Reset all subsequent steps to pending and clear their data
          for (let i = editedStepIndex + 1; i < PIPELINE_STEPS.length; i++) {
            const stepKey = PIPELINE_STEPS[i].key;
            state.generationProgress.steps[stepKey] = "pending";

            // Clear the step data
            switch (stepKey) {
              case "entity-extraction":
                state.generationProgress.stepData.entities = undefined;
                break;
              case "social-graph":
                state.generationProgress.stepData.socialGraph = undefined;
                break;
              case "timeline":
                state.generationProgress.stepData.timeline = undefined;
                break;
              case "phone-selection":
                state.generationProgress.stepData.selectedPhones = undefined;
                break;
            }
          }

          // Set current step to the edited step so we continue from there
          state.generationProgress.currentStep = editedStep;

          // Start auto-continue from the edited step
          state.autoContinue = {
            isActive: true,
            remainingSeconds: 15,
            stepKey: editedStep,
          };
        }
      }),

    updateEditedData: <K extends keyof StepData>(key: K, data: StepData[K]) =>
      set((state) => {
        state.editedData[key] = data;
      }),

    // Reset
    resetConversation: () =>
      set((state) => {
        state.isConversationStarted = false;
        state.messages = [];
        state.isLoading = false;
        state.initialPrompt = "";
        state.isGenerating = false;
        state.generationProgress = { ...initialGenerationProgress };
        state.autoContinue = { ...initialAutoContinue };
        state.editingStep = null;
        state.editedData = {};
        state.error = null;
      }),

    setError: (error: string | null) =>
      set((state) => {
        state.error = error;
      }),
  }))
);
