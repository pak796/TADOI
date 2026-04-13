export function shouldTriggerSaveConflictRetryFromMouse(params: {
  isSaveConflictBanner: boolean;
  retryPending: boolean;
  button: number;
}): boolean {
  return (
    params.isSaveConflictBanner && !params.retryPending && params.button === 0
  );
}
