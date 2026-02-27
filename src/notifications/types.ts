export type TaskOverdueEvent = {
  type: "TASK_OVERDUE";
  taskId: string;
  title: string;
  dueAt: string;
  firedAt: string;
};

export type TaskReminderEvent = {
  type: "TASK_REMINDER";
  taskId: string;
  title: string;
  effectiveReminderAt: number;
  dueAt?: string;
  firedAt: string;
};

export type NotificationEvent = TaskOverdueEvent;
export type NotificationModalEvent = TaskOverdueEvent | TaskReminderEvent;
