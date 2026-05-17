export type SupportedKind =
  | 'markdown'
  | 'yaml'
  | 'json'
  | 'typescript'
  | 'python'
  | 'prompt'
  | 'unknown';

export function detectKind(fileName: string): SupportedKind {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.prompt')) return 'prompt';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.py')) return 'python';

  return 'unknown';
}
