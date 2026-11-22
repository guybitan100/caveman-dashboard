// Real BPE token counting for Copilot assistant output. The bare
// "gpt-tokenizer/encoding/o200k_base" specifier is what esbuild can bundle (it resolves
// via the package "exports" map). tsc's classic node resolution ignores that map, so the
// module's type is supplied by the ambient declaration in src/gpt-tokenizer.d.ts.
import { encode } from 'gpt-tokenizer/encoding/o200k_base';

/**
 * Real output-token count for a piece of Copilot assistant text.
 *
 * Uses the o200k_base BPE (the tokenizer for the GPT-4o / GPT-5 family that backs
 * Copilot's default models), replacing the old `text.length / 4` char heuristic — so
 * the output-token figure is a measured token count of the actual transcript text,
 * not a guess. For the occasional non-o200k model routed through Copilot this is still
 * an approximation, but far closer than a fixed character ratio. Falls back to the
 * char heuristic only if encoding throws.
 */
export function countOutputTokens(text: string): number {
  if (!text) return 0;
  try {
    return encode(text).length;
  } catch {
    return Math.round(text.length / 4);
  }
}
