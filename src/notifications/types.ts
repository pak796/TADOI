export type TaskOverdueEvent = {
  type: "TASK_OVERDUE";
  taskId: string;
  title: string;
  dueAt: string;
  firedAt: string;
};

export type NotificationEvent = TaskOverdueEvent;
