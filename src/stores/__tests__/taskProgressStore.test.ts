import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskProgressStore } from '../../stores/taskProgressStore';

describe('taskProgressStore', () => {
  beforeEach(() => {
    const { setState } = useTaskProgressStore;
    setState({
      taskProgress: new Map(),
      pollingJobs: new Set(),
    });
  });

  it('has correct initial state', () => {
    const state = useTaskProgressStore.getState();
    expect(state.taskProgress.size).toBe(0);
    expect(state.pollingJobs.size).toBe(0);
  });

  describe('startJobPolling', () => {
    it('adds job to polling set and initializes tasks', () => {
      useTaskProgressStore.getState().startJobPolling('job1', ['t1', 't2']);

      const state = useTaskProgressStore.getState();
      expect(state.pollingJobs.has('job1')).toBe(true);
      expect(state.taskProgress.size).toBe(2);
      expect(state.taskProgress.get('t1')?.status).toBe('Pending');
      expect(state.taskProgress.get('t1')?.isPolling).toBe(true);
    });

    it('does not overwrite existing task progress', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Generating', progress: 0.5 },
      ]);
      useTaskProgressStore.getState().startJobPolling('job1', ['t1', 't2']);

      const state = useTaskProgressStore.getState();
      expect(state.taskProgress.get('t1')?.status).toBe('Generating');
      expect(state.taskProgress.get('t2')?.status).toBe('Pending');
    });
  });

  describe('stopJobPolling', () => {
    it('removes job from polling set', () => {
      useTaskProgressStore.getState().startJobPolling('job1', ['t1']);
      useTaskProgressStore.getState().stopJobPolling('job1');

      expect(useTaskProgressStore.getState().pollingJobs.has('job1')).toBe(false);
    });
  });

  describe('updateMultipleTaskProgress', () => {
    it('updates multiple task progress entries', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Generating', progress: 0.3 },
        { taskId: 't2', status: 'Done', progress: 1.0 },
      ]);

      const state = useTaskProgressStore.getState();
      expect(state.taskProgress.get('t1')?.status).toBe('Generating');
      expect(state.taskProgress.get('t1')?.progress).toBe(0.3);
      expect(state.taskProgress.get('t1')?.isPolling).toBe(true);
      expect(state.taskProgress.get('t2')?.status).toBe('Done');
      expect(state.taskProgress.get('t2')?.isPolling).toBe(false);
    });
  });

  describe('getTaskProgress', () => {
    it('returns undefined for unknown task', () => {
      expect(useTaskProgressStore.getState().getTaskProgress('unknown')).toBeUndefined();
    });

    it('returns progress for known task', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Generating', progress: 0.5 },
      ]);

      const result = useTaskProgressStore.getState().getTaskProgress('t1');
      expect(result?.status).toBe('Generating');
      expect(result?.progress).toBe(0.5);
    });
  });

  describe('getEventTypeProgress', () => {
    it('returns default progress when no tasks found', () => {
      const result = useTaskProgressStore.getState().getEventTypeProgress('job1', 'images', ['t1', 't2']);
      expect(result.status).toBe('Pending');
      expect(result.progress).toBe(0);
      expect(result.totalTasks).toBe(2);
    });

    it('aggregates progress from multiple tasks', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Done', progress: 1.0 },
        { taskId: 't2', status: 'Generating', progress: 0.5 },
      ]);

      const result = useTaskProgressStore.getState().getEventTypeProgress('job1', 'images', ['t1', 't2']);
      expect(result.progress).toBe(0.75);
      expect(result.completedTasks).toBe(1);
      expect(result.generatingTasks).toBe(1);
      expect(result.totalTasks).toBe(2);
    });

    it('counts failed tasks', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Failed', progress: 0 },
        { taskId: 't2', status: 'Cancelled', progress: 0 },
      ]);

      const result = useTaskProgressStore.getState().getEventTypeProgress('job1', 'images', ['t1', 't2']);
      expect(result.failedTasks).toBe(2);
      expect(result.status).toBe('Failed');
    });
  });

  describe('hasActiveTasksForJob', () => {
    it('returns true when no progress data exists', () => {
      expect(
        useTaskProgressStore.getState().hasActiveTasksForJob('job1', ['t1'])
      ).toBe(true);
    });

    it('returns true when tasks are still generating', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Generating', progress: 0.5 },
      ]);

      expect(
        useTaskProgressStore.getState().hasActiveTasksForJob('job1', ['t1'])
      ).toBe(true);
    });

    it('returns false when all tasks are terminal', () => {
      useTaskProgressStore.getState().updateMultipleTaskProgress([
        { taskId: 't1', status: 'Done', progress: 1.0 },
        { taskId: 't2', status: 'Failed', progress: 0 },
      ]);

      expect(
        useTaskProgressStore.getState().hasActiveTasksForJob('job1', ['t1', 't2'])
      ).toBe(false);
    });
  });
});
