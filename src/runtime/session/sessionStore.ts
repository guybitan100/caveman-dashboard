import { AISession } from './sessionModels';

const sessionStoreKey = 'tokenlint.runtimeSessions';
const maxSessions = 240;

export interface SessionStoreBackend {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Promise<void> | Thenable<void>;
}

export class RuntimeSessionStore {
  constructor(private readonly backend: SessionStoreBackend) {}

  getSessions(): AISession[] {
    return [...this.backend.get<AISession[]>(sessionStoreKey, [])].sort((left, right) => {
      return getSessionTime(right) - getSessionTime(left);
    });
  }

  async saveSessions(sessions: AISession[]): Promise<void> {
    const sorted = [...sessions].sort((left, right) => getSessionTime(right) - getSessionTime(left));
    await this.backend.update(sessionStoreKey, sorted.slice(0, maxSessions));
  }
}

function getSessionTime(session: AISession): number {
  return session.endedAt ?? session.startedAt;
}