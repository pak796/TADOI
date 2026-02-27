import { describe, expect, it } from "bun:test";
import type { Task } from "../models";
import { materializeChecklistOccurrenceOverride } from "./checklistOccurrence";

function baseSeriesTask(nowMs: number): Task {
  return {
    id: "series-task-1",
    title: "Series",
    status: "open",
    createdAt: nowMs - 1000,
    updatedAt: nowMs - 1000,
    dueAt: nowMs - 1000,
    hasExplicitTime: true,
    tags: ["work"],
    recurrence: {
      dtstart: "2026-02-01T09:00:00",
      rrule: "FREQ=DAILY;INTERVAL=1",
      series_id: "series:task-1",
      exdates: ["2026-02-03T09:00:00"]
    },
    checklist: [
      {
        id: "item-1",
        text: "Item",
        isDone: false,
        createdAt: "2026-02-01T09:00:00.000Z",
        updatedAt: "2026-02-01T09:00:00.000Z",
        sort: 0
      }
    ]
  };
}

describe("materializeChecklistOccurrenceOverride", () => {
  it("materializes a new occurrence override without mutating series EXDATE", () => {
    const nowMs = new Date(2026, 1, 10, 12, 0, 0, 0).getTime();
    const seriesTask = baseSeriesTask(nowMs);
    const result = materializeChecklistOccurrenceOverride({
      tasks: [seriesTask],
      context: {
        seriesTask,
        seriesId: "series:task-1",
        occurrenceIso: "2026-02-10T09:00:00"
      },
      checklist: [
        {
          id: "item-1",
          text: "Item",
          isDone: true,
          createdAt: "2026-02-01T09:00:00.000Z",
          updatedAt: "2026-02-10T12:00:00.000Z",
          completedAt: "2026-02-10T12:00:00.000Z",
          sort: 0
        }
      ],
      nowMs
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const persistedSeries = result.tasks.find((task) => task.id === seriesTask.id);
    const instance = result.tasks.find(
      (task) =>
        task.instance_of?.series_id === "series:task-1" &&
        task.instance_of?.occurrence === "2026-02-10T09:00:00"
    );
    expect(instance).toBeDefined();
    expect(instance?.checklist?.[0]?.isDone).toBe(true);
    expect(persistedSeries?.recurrence?.exdates).toEqual(["2026-02-03T09:00:00"]);
  });

  it("replaces an existing materialized occurrence override deterministically", () => {
    const nowMs = new Date(2026, 1, 10, 12, 0, 0, 0).getTime();
    const seriesTask = baseSeriesTask(nowMs);
    const existingInstance: Task = {
      id: "instance-1",
      title: "Series",
      status: "open",
      createdAt: nowMs - 500,
      updatedAt: nowMs - 500,
      dueAt: new Date(2026, 1, 10, 9, 0, 0, 0).getTime(),
      hasExplicitTime: true,
      tags: ["work"],
      checklist: [
        {
          id: "item-1",
          text: "Item",
          isDone: false,
          createdAt: "2026-02-01T09:00:00.000Z",
          updatedAt: "2026-02-10T11:50:00.000Z",
          sort: 0
        }
      ],
      instance_of: {
        series_id: "series:task-1",
        occurrence: "2026-02-10T09:00:00"
      }
    };

    const result = materializeChecklistOccurrenceOverride({
      tasks: [seriesTask, existingInstance],
      context: {
        seriesTask,
        seriesId: "series:task-1",
        occurrenceIso: "2026-02-10T09:00:00",
        instanceTask: existingInstance
      },
      checklist: [
        {
          id: "item-1",
          text: "Item",
          isDone: true,
          createdAt: "2026-02-01T09:00:00.000Z",
          updatedAt: "2026-02-10T12:00:00.000Z",
          completedAt: "2026-02-10T12:00:00.000Z",
          sort: 0
        }
      ],
      nowMs
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const matchingInstances = result.tasks.filter(
      (task) =>
        task.instance_of?.series_id === "series:task-1" &&
        task.instance_of?.occurrence === "2026-02-10T09:00:00"
    );
    expect(matchingInstances).toHaveLength(1);
    expect(matchingInstances[0]?.id).toBe("instance-1");
    expect(matchingInstances[0]?.checklist?.[0]?.isDone).toBe(true);
    const persistedSeries = result.tasks.find((task) => task.id === seriesTask.id);
    expect(persistedSeries?.recurrence?.exdates).toEqual(["2026-02-03T09:00:00"]);
  });
});
