let shouldUpdateSnapshots = false;

export function setSnapshotUpdateMode(enabled: boolean): void {
  shouldUpdateSnapshots = enabled;
}

export function getSnapshotUpdateMode(): boolean {
  return shouldUpdateSnapshots;
}
