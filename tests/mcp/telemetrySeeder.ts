import { RuntimeSessionManager } from '../../src/runtime/session/sessionManager';
import { AISession, SessionTelemetry } from '../../src/runtime/session/sessionModels';

import { buildTelemetry, TelemetrySeed } from './sessionFactory';

export interface SeededSession {
  seed: TelemetrySeed;
  telemetry: SessionTelemetry;
  session: AISession;
}

export async function seedTelemetry(
  manager: RuntimeSessionManager,
  seeds: TelemetrySeed[]
): Promise<SeededSession[]> {
  const seeded: SeededSession[] = [];

  for (const seed of seeds) {
    const telemetry = buildTelemetry(seed);
    const session = await manager.recordTelemetry(telemetry);
    if (seed.favorite) {
      const favoriteSession = await manager.toggleFavorite(session.id);
      seeded.push({
        seed,
        telemetry,
        session: favoriteSession ?? session
      });
      continue;
    }

    seeded.push({ seed, telemetry, session });
  }

  return seeded;
}