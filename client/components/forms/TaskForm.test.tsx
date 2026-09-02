import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskForm } from "./TaskForm";

const submit = vi.fn().mockResolvedValue(undefined);
const cancel = vi.fn();

describe("TaskForm", () => {
  it("shows validation feedback when a task title is missing", () => {
    const { container } = render(
      <TaskForm
        members={[]}
        onSubmit={submit}
        onCancel={cancel}
        isSubmitting={false}
        submitLabel="Create Task"
      />,
    );

    fireEvent.submit(container.querySelector("form")!);

    expect(screen.getByRole("alert").textContent).toContain(
      "Give this task a clear title.",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("prevents edits in read-only mode while preserving a way back", () => {
    render(
      <TaskForm
        initialData={{
          title: "Review copy",
          description: "",
          status: "todo",
          priority: "medium",
          due_date: "",
          assignee_id: "none",
        }}
        members={[]}
        onSubmit={submit}
        onCancel={cancel}
        isSubmitting={false}
        submitLabel="Save Changes"
        readOnly
      />,
    );

    expect(screen.getByLabelText(/Title/).matches(":disabled")).toBe(true);
    expect(
      screen.getByText("You have view-only access to this task."),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Back to project" }),
    ).toHaveProperty("disabled", false);
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
  });
});
