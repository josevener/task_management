import type { Project } from "@/lib/types";

export function filterProjects(
  projects: Project[],
  searchQuery: string,
  statusFilter: string,
  healthFilter: string,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return projects.filter((project) => {
    const matchesSearch =
      !normalizedQuery ||
      project.name.toLowerCase().includes(normalizedQuery) ||
      (project.description || "").toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    const matchesHealth =
      healthFilter === "all" || project.health_status === healthFilter;

    return matchesSearch && matchesStatus && matchesHealth;
  });
}
