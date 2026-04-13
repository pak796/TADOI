export type EditTargetSwitchDecision =
  | { type: "ignore" }
  | { type: "switch_now"; toTaskId: string }
  | { type: "prompt"; fromTaskId: string; toTaskId: string };

export function decideEditTargetSwitch(input: {
  fromTaskId: string | undefined;
  toTaskId: string;
  isDirty: boolean;
  hasActiveModal: boolean;
}): EditTargetSwitchDecision {
  if (input.hasActiveModal) {
    return { type: "ignore" };
  }
  if (!input.fromTaskId) {
    return { type: "ignore" };
  }
  if (input.fromTaskId === input.toTaskId) {
    return { type: "ignore" };
  }
  if (!input.isDirty) {
    return { type: "switch_now", toTaskId: input.toTaskId };
  }
  return {
    type: "prompt",
    fromTaskId: input.fromTaskId,
    toTaskId: input.toTaskId,
  };
}
