import { describe, expect, it } from "vitest";
import { filterProjects } from "@/lib/project-filters";
import type { Project } from "@/lib/types";

const projects: Project[] = [
  {
    id: 1,
    workspace_id: 1,
    name: "Website Redesign",
    description: "Refresh the public site",
    status: "active",
    owner_id: 1,
    progress_percentage: 25,
    health_status: "on_track",
    is_template: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    workspace_id: 1,
    name: "Mobile App",
    description: "Resolve launch defects",
    status: "on_hold",
    owner_id: 1,
    progress_percentage: 0,
    health_status: "at_risk",
    is_template: false,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("filterProjects", () => {
  it("combines search, status, and health filters", () => {
    expect(filterProjects(projects, "launch", "on_hold", "at_risk")).toEqual([
      projects[1],
    ]);
  });

  it("returns no project when any active filter does not match", () => {
    expect(filterProjects(projects, "website", "active", "at_risk")).toEqual(
      [],
    );
  });
});
