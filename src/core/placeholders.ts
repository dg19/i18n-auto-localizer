export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{[^{}]+\}\}|\{[^{}]+\}/g);
  return matches ?? [];
}

export function placeholdersMatch(source: string, translated: string): boolean {
  const sourceSet = [...extractPlaceholders(source)].sort();
  const translatedSet = [...extractPlaceholders(translated)].sort();
  if (sourceSet.length !== translatedSet.length) return false;
  return sourceSet.every((p, i) => p === translatedSet[i]);
}
