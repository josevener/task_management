import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  CheckSquare,
  Settings,
  ChevronDown,
  Plus,
  Building2
} from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { workspaces, activeWorkspace, switchWorkspace, loading } = useWorkspace();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Workspaces", href: "/workspaces", icon: Briefcase },
    { name: "Projects", href: "/projects", icon: FolderKanban },
    { name: "My Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Organizations", href: "/organizations", icon: Building2 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-slate-950 text-slate-300 border-r border-slate-800",
        className
      )}
    >
      <div className="p-4 border-b border-slate-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between h-auto py-2 px-3 hover:bg-slate-800 hover:text-white"
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: activeWorkspace?.color_theme || '#2563eb' }}
                >
                  {activeWorkspace ? activeWorkspace.name.substring(0, 2).toUpperCase() : <Briefcase size={16} />}
                </div>
                <div className="flex flex-col items-start truncate text-left w-32">
                  <span className="text-sm font-semibold truncate w-full text-white">
                    {loading ? "Loading..." : (activeWorkspace?.name || "Zentrix")}
                  </span>
                  <span className="text-xs text-slate-400 truncate w-full">
                    {activeWorkspace?.organization_name || "Workspaces"}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => (
              <DropdownMenuItem 
                key={workspace.id}
                onClick={() => switchWorkspace(workspace)}
                className={activeWorkspace?.id === workspace.id ? "bg-slate-100 dark:bg-slate-800" : ""}
              >
                <div 
                  className="w-6 h-6 rounded mr-2 flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: workspace.color_theme || '#2563eb' }}
                >
                  {workspace.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="truncate">{workspace.name}</span>
              </DropdownMenuItem>
            ))}
            {workspaces.length === 0 && (
              <div className="text-xs text-center text-muted-foreground p-2">
                No workspaces found
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/workspaces/new" className="cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                <span>Create Workspace</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-4 py-4 flex-1 overflow-y-auto">
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
          Menu
        </h3>
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-white hover:bg-slate-800/50",
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-400"
                )}
              >
                <item.icon size={18} className={isActive ? "text-blue-500" : ""} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
