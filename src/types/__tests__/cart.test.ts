import { describe, it, expect } from 'vitest';
import {
  extractSubtasks,
  CART_SECTIONS,
  type GenerationTask,
  type EventType,
} from '../../types/cart';

describe('extractSubtasks', () => {
  it('returns empty map for empty tasks array', () => {
    const result = extractSubtasks([]);
    expect(result.size).toBe(0);
  });

  it('returns empty map when no tasks have attachments', () => {
    const tasks: GenerationTask[] = [
      { task_id: 't1', event_type: 'images', quantity: 5 },
      { task_id: 't2', event_type: 'calls', quantity: 3 },
    ];
    const result = extractSubtasks(tasks);
    expect(result.size).toBe(0);
  });

  it('extracts subtasks from attachments', () => {
    const tasks: GenerationTask[] = [
      {
        task_id: 't1',
        event_type: 'chat messages',
        quantity: 10,
        attachments: [
          { task_id: 'a1', event_type: 'images', quantity: 2 },
          { task_id: 'a2', event_type: 'videos', quantity: 1 },
        ],
      },
    ];
    const result = extractSubtasks(tasks);
    expect(result.size).toBe(2);
    expect(result.get('images')?.length).toBe(1);
    expect(result.get('videos')?.length).toBe(1);
    expect(result.get('images')![0].parentTask.task_id).toBe('t1');
    expect(result.get('images')![0].parentEventType).toBe('chat messages');
  });

  it('groups subtasks of the same event type', () => {
    const tasks: GenerationTask[] = [
      {
        task_id: 't1',
        event_type: 'chat messages',
        quantity: 10,
        attachments: [
          { task_id: 'a1', event_type: 'images', quantity: 2 },
        ],
      },
      {
        task_id: 't2',
        event_type: 'emails',
        quantity: 5,
        attachments: [
          { task_id: 'a2', event_type: 'images', quantity: 3 },
        ],
      },
    ];
    const result = extractSubtasks(tasks);
    expect(result.get('images')?.length).toBe(2);
  });

  it('ignores tasks with empty attachments array', () => {
    const tasks: GenerationTask[] = [
      { task_id: 't1', event_type: 'images', quantity: 5, attachments: [] },
    ];
    const result = extractSubtasks(tasks);
    expect(result.size).toBe(0);
  });
});

describe('CART_SECTIONS', () => {
  it('has 5 sections', () => {
    expect(CART_SECTIONS).toHaveLength(5);
  });

  it('contains expected section keys', () => {
    const keys = CART_SECTIONS.map((s) => s.key);
    expect(keys).toContain('deviceContext');
    expect(keys).toContain('tasks');
    expect(keys).toContain('stories');
    expect(keys).toContain('entities');
    expect(keys).toContain('customEvents');
  });

  it('each section has title and icon', () => {
    for (const section of CART_SECTIONS) {
      expect(section.title).toBeTruthy();
      expect(section.icon).toBeTruthy();
    }
  });
});
