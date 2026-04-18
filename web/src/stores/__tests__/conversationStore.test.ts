import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('../../api/pipelineApi', () => ({
  pipelineApi: {
    expandStory: vi.fn(),
    extractEntities: vi.fn(),
    generateSocialGraph: vi.fn(),
    generateTimeline: vi.fn(),
    selectPhones: vi.fn(),
    generateStories: vi.fn(),
    submitJob: vi.fn(),
  },
}));

vi.mock('../../api/ufdrApi', () => ({
  ufdrApi: {
    submitJob: vi.fn(),
    getJobStatus: vi.fn(),
    pollJobStatuses: vi.fn(),
    isTerminalStatus: vi.fn(),
    isSuccessStatus: vi.fn(),
  },
}));

import { useConversationStore } from '../../stores/conversationStore';

describe('conversationStore', () => {
  beforeEach(() => {
    useConversationStore.getState().resetConversation();
  });

  describe('initial state', () => {
    it('is not started', () => {
      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.initialPrompt).toBe('');
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.editingStep).toBeNull();
    });
  });

  describe('startConversation', () => {
    it('sets conversation started and adds user message', () => {
      useConversationStore.getState().startConversation('Create a phone for Alice');

      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(true);
      expect(state.initialPrompt).toBe('Create a phone for Alice');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('Create a phone for Alice');
    });
  });

  describe('addMessage', () => {
    it('adds an assistant message', () => {
      useConversationStore.getState().addMessage({
        role: 'assistant',
        content: 'Hello!',
      });

      const { messages } = useConversationStore.getState();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].id).toBeTruthy();
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('setLoading', () => {
    it('sets loading state', () => {
      useConversationStore.getState().setLoading(true);
      expect(useConversationStore.getState().isLoading).toBe(true);
      useConversationStore.getState().setLoading(false);
      expect(useConversationStore.getState().isLoading).toBe(false);
    });
  });

  describe('startGeneration', () => {
    it('sets generating flag and first step in-progress', () => {
      useConversationStore.getState().startGeneration();

      const state = useConversationStore.getState();
      expect(state.isGenerating).toBe(true);
      expect(state.generationProgress.currentStep).toBe('story-expansion');
      expect(state.generationProgress.steps['story-expansion']).toBe('in-progress');
    });
  });

  describe('updateGenerationStep', () => {
    it('updates a step status', () => {
      useConversationStore.getState().updateGenerationStep('story-expansion', 'completed');
      expect(
        useConversationStore.getState().generationProgress.steps['story-expansion']
      ).toBe('completed');
    });
  });

  describe('setCurrentStep', () => {
    it('sets current step and marks it in-progress', () => {
      useConversationStore.getState().setCurrentStep('entity-extraction');

      const state = useConversationStore.getState();
      expect(state.generationProgress.currentStep).toBe('entity-extraction');
      expect(state.generationProgress.steps['entity-extraction']).toBe('in-progress');
    });

    it('handles null step', () => {
      useConversationStore.getState().setCurrentStep(null);
      expect(useConversationStore.getState().generationProgress.currentStep).toBeNull();
    });
  });

  describe('setStepData', () => {
    it('sets story expansion data', () => {
      const expansion = {
        original_description: 'test',
        expanded_narrative: 'expanded',
        setting: 'office',
        key_themes: ['work'],
        generated_at: '2024-01-01',
      };
      useConversationStore.getState().setStepData('storyExpansion', expansion);
      expect(
        useConversationStore.getState().generationProgress.stepData.storyExpansion
      ).toEqual(expansion);
    });
  });

  describe('toggleStepExpanded', () => {
    it('toggles step expansion', () => {
      useConversationStore.getState().toggleStepExpanded('story-expansion');
      expect(
        useConversationStore.getState().generationProgress.expandedSteps['story-expansion']
      ).toBe(true);

      useConversationStore.getState().toggleStepExpanded('story-expansion');
      expect(
        useConversationStore.getState().generationProgress.expandedSteps['story-expansion']
      ).toBe(false);
    });
  });

  describe('auto-continue', () => {
    it('startAutoContinue sets timer state', () => {
      useConversationStore.getState().startAutoContinue('story-expansion');

      const { autoContinue } = useConversationStore.getState();
      expect(autoContinue.isActive).toBe(true);
      expect(autoContinue.remainingSeconds).toBe(15);
      expect(autoContinue.stepKey).toBe('story-expansion');
    });

    it('stopAutoContinue resets timer state', () => {
      useConversationStore.getState().startAutoContinue('story-expansion');
      useConversationStore.getState().stopAutoContinue();

      const { autoContinue } = useConversationStore.getState();
      expect(autoContinue.isActive).toBe(false);
      expect(autoContinue.stepKey).toBeNull();
    });

    it('tickAutoContinue decrements seconds', () => {
      useConversationStore.getState().startAutoContinue('story-expansion');
      useConversationStore.getState().tickAutoContinue();

      expect(useConversationStore.getState().autoContinue.remainingSeconds).toBe(14);
    });

    it('tickAutoContinue does nothing when not active', () => {
      useConversationStore.getState().tickAutoContinue();
      // No error thrown
      expect(useConversationStore.getState().autoContinue.isActive).toBe(false);
    });
  });

  describe('edit actions', () => {
    it('startEditing sets editing step and copies data', () => {
      const expansion = {
        original_description: 'test',
        expanded_narrative: 'expanded',
        setting: 'office',
        key_themes: [],
        generated_at: '2024-01-01',
      };
      useConversationStore.getState().setStepData('storyExpansion', expansion);
      useConversationStore.getState().startEditing('story-expansion');

      const state = useConversationStore.getState();
      expect(state.editingStep).toBe('story-expansion');
      expect(state.editedData.storyExpansion).toEqual(expansion);
      expect(state.autoContinue.isActive).toBe(false);
    });

    it('cancelEditing clears editing state', () => {
      useConversationStore.getState().startEditing('story-expansion');
      useConversationStore.getState().cancelEditing();

      const state = useConversationStore.getState();
      expect(state.editingStep).toBeNull();
      expect(state.editedData).toEqual({});
    });

    it('cancelEditing resumes auto-continue if step was completed', () => {
      useConversationStore.getState().setCurrentStep('story-expansion');
      useConversationStore.getState().updateGenerationStep('story-expansion', 'completed');
      useConversationStore.getState().startEditing('story-expansion');
      useConversationStore.getState().cancelEditing();

      expect(useConversationStore.getState().autoContinue.isActive).toBe(true);
    });

    it('updateEditedData sets edited data', () => {
      useConversationStore.getState().updateEditedData('entities', []);
      expect(useConversationStore.getState().editedData.entities).toEqual([]);
    });

    it('saveEdits applies edits and resets subsequent steps', () => {
      // Set up step data for first two steps
      useConversationStore.getState().setStepData('storyExpansion', {
        original_description: 'test',
        expanded_narrative: 'expanded',
        setting: 'office',
        key_themes: [],
        generated_at: '2024-01-01',
      });
      useConversationStore.getState().setStepData('entities', [{ entity_id: 'e1', name: 'A' } as any]);
      useConversationStore.getState().updateGenerationStep('story-expansion', 'completed');
      useConversationStore.getState().updateGenerationStep('entity-extraction', 'completed');

      // Start editing story-expansion
      useConversationStore.getState().startEditing('story-expansion');
      useConversationStore.getState().saveEdits();

      const state = useConversationStore.getState();
      expect(state.editingStep).toBeNull();
      // entity-extraction should be reset to pending
      expect(state.generationProgress.steps['entity-extraction']).toBe('pending');
      // auto-continue should start from edited step
      expect(state.autoContinue.isActive).toBe(true);
      expect(state.autoContinue.stepKey).toBe('story-expansion');
    });
  });

  describe('setError', () => {
    it('sets and clears error', () => {
      useConversationStore.getState().setError('something broke');
      expect(useConversationStore.getState().error).toBe('something broke');

      useConversationStore.getState().setError(null);
      expect(useConversationStore.getState().error).toBeNull();
    });
  });

  describe('resetConversation', () => {
    it('resets all state to initial', () => {
      useConversationStore.getState().startConversation('hello');
      useConversationStore.getState().startGeneration();
      useConversationStore.getState().setError('err');

      useConversationStore.getState().resetConversation();

      const state = useConversationStore.getState();
      expect(state.isConversationStarted).toBe(false);
      expect(state.messages).toEqual([]);
      expect(state.isGenerating).toBe(false);
      expect(state.error).toBeNull();
      expect(state.initialPrompt).toBe('');
    });
  });
});
