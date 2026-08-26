import { describe, it, expect } from "vitest";
import { IT_PROJECT_PRIORITY } from "../../shared/constants/itProjectTypes";
import {
  PlainWorkItem,
  sortByPriorityThenUrgency,
  sortByUrgencyThenPriority,
} from "./it-work-item-my-dashboard.service";

// The only DB-independent logic in it-work-item-my-dashboard.service.ts —
// see that file's Testing note and the Phase 1E-B report for why the rest
// of the service (actor-scoped Mongo queries) isn't covered by an
// integration-test harness this codebase has never used elsewhere.

function item(overrides: Partial<PlainWorkItem>): PlainWorkItem {
  return {
    _id: overrides._id ?? "id",
    workItemId: "ITW-0001",
    title: "Test item",
    status: "IN_PROGRESS",
    priority: IT_PROJECT_PRIORITY.MEDIUM,
    dueDate: null,
    completedAt: null,
    reviewNote: null,
    updatedAt: new Date(),
    overdue: false,
    ...overrides,
  } as PlainWorkItem;
}

describe("sortByPriorityThenUrgency (My Work ordering — Part 6)", () => {
  it("puts URGENT before HIGH before MEDIUM before LOW", () => {
    const low = item({ _id: "low", priority: IT_PROJECT_PRIORITY.LOW });
    const urgent = item({ _id: "urgent", priority: IT_PROJECT_PRIORITY.URGENT });
    const medium = item({ _id: "medium", priority: IT_PROJECT_PRIORITY.MEDIUM });
    const high = item({ _id: "high", priority: IT_PROJECT_PRIORITY.HIGH });

    const sorted = [low, urgent, medium, high].sort(sortByPriorityThenUrgency);

    expect(sorted.map((i) => i._id)).toEqual(["urgent", "high", "medium", "low"]);
  });

  it("within the same priority, puts overdue items before non-overdue items", () => {
    const notOverdue = item({ _id: "not-overdue", overdue: false, dueDate: "2099-01-01" });
    const overdue = item({ _id: "overdue", overdue: true, dueDate: "2020-01-01" });

    const sorted = [notOverdue, overdue].sort(sortByPriorityThenUrgency);

    expect(sorted.map((i) => i._id)).toEqual(["overdue", "not-overdue"]);
  });

  it("within the same priority and overdue-ness, sorts by due date ascending, undated last", () => {
    const noDueDate = item({ _id: "no-date", dueDate: null });
    const later = item({ _id: "later", dueDate: "2026-06-01" });
    const sooner = item({ _id: "sooner", dueDate: "2026-01-01" });

    const sorted = [noDueDate, later, sooner].sort(sortByPriorityThenUrgency);

    expect(sorted.map((i) => i._id)).toEqual(["sooner", "later", "no-date"]);
  });

  it("never hides lower-priority work — every item passed in is still present after sorting", () => {
    const items = [
      item({ _id: "a", priority: IT_PROJECT_PRIORITY.LOW }),
      item({ _id: "b", priority: IT_PROJECT_PRIORITY.URGENT }),
      item({ _id: "c", priority: IT_PROJECT_PRIORITY.MEDIUM }),
    ];
    const sorted = [...items].sort(sortByPriorityThenUrgency);
    expect(sorted).toHaveLength(3);
    expect(new Set(sorted.map((i) => i._id))).toEqual(new Set(["a", "b", "c"]));
  });
});

describe("sortByUrgencyThenPriority (Next Up ordering — Part 7)", () => {
  it("puts overdue items first regardless of priority", () => {
    const urgentNotOverdue = item({
      _id: "urgent-not-overdue",
      priority: IT_PROJECT_PRIORITY.URGENT,
      overdue: false,
    });
    const lowOverdue = item({ _id: "low-overdue", priority: IT_PROJECT_PRIORITY.LOW, overdue: true });

    const sorted = [urgentNotOverdue, lowOverdue].sort(sortByUrgencyThenPriority);

    expect(sorted.map((i) => i._id)).toEqual(["low-overdue", "urgent-not-overdue"]);
  });

  it("among non-overdue items, falls back to priority rank", () => {
    const high = item({ _id: "high", priority: IT_PROJECT_PRIORITY.HIGH, overdue: false });
    const low = item({ _id: "low", priority: IT_PROJECT_PRIORITY.LOW, overdue: false });

    const sorted = [low, high].sort(sortByUrgencyThenPriority);

    expect(sorted.map((i) => i._id)).toEqual(["high", "low"]);
  });
});
