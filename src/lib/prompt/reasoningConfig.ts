let shouldSaveReasoning = false;

export function setSaveReasoningMode(enabled: boolean): void {
  shouldSaveReasoning = enabled;
}

export function getSaveReasoningMode(): boolean {
  return shouldSaveReasoning;
}
