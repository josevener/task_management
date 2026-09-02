import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  ListTodo,
  Settings,
  ChevronDown,
  Plus,
  Building2,
  Users,
  ShieldAlert,
  ChevronRight
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

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  show: boolean;
  children?: { name: string; href: string }[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  isCollapsed?: boolean;
}

export function Sidebar({ className, onNavigate, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { workspaces, activeWorkspace, switchWorkspace, loading, hasPermission } = useWorkspace();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [hoveredItem, setHoveredItem] = useState<{ item: NavItem, top: number } | null>(null);
  const [isHoveringPopup, setIsHoveringPopup] = useState(false);

  // Sync open menus with current path
  useEffect(() => {
    if (!isCollapsed) {
      const newOpenMenus = { ...openMenus };
      let updated = false;

      navigationSections.forEach(section => {
        section.items.forEach(item => {
          if (item.children?.some(child => pathname.startsWith(child.href))) {
            if (!newOpenMenus[item.name]) {
              newOpenMenus[item.name] = true;
              updated = true;
            }
          }
        });
      });

      if (updated) setOpenMenus(newOpenMenus);
    }
  }, [pathname, isCollapsed]);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleItemMouseEnter = (e: React.MouseEvent, item: NavItem) => {
    if (!isCollapsed || (item.children?.length === 0 && !item.href)) return;

    // Reset state for new item immediately
    setIsHoveringPopup(false);

    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({ item, top: rect.top });
  };

  const handleItemMouseLeave = (e: React.MouseEvent) => {
    if (!isCollapsed) return;

    // Check if we are moving to the popup
    const relatedTarget = e.relatedTarget;
    if (relatedTarget instanceof Element && relatedTarget.closest('[data-side-popup="true"]')) {
      return;
    }

    setHoveredItem(null);
  };

  const navigationSections: NavSection[] = [
    {
      title: "General",
      items: [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, show: hasPermission('dashboard:view') },
        { name: "Organizations", href: "/organizations", icon: Building2, show: hasPermission('organizations:view') },
      ]
    },
    {
      title: "Maintenance",
      items: [
        { name: "Workspaces", href: "/workspaces", icon: Briefcase, show: hasPermission('workspaces:view') },
        { name: "Projects", href: "/projects", icon: FolderKanban, show: hasPermission('projects:view') },
        {
          name: "Tasks",
          icon: ListTodo,
          show: hasPermission('tasks:view'),
          children: [
            { name: "All Tasks", href: "/tasks" },
            { name: "My Tasks", href: "/my-tasks" },
          ]
        },
        ...(activeWorkspace ? [
          { name: "Team Management", href: `/workspaces/${activeWorkspace.id}/members`, icon: Users, show: hasPermission('members:view') },
          { name: "Roles", href: `/workspaces/${activeWorkspace.id}/roles`, icon: ShieldAlert, show: hasPermission('roles:view') || hasPermission('roles:edit') || activeWorkspace.user_role === 'Admin' }
        ] : []),
      ]
    },
    {
      title: "Settings",
      items: [
        {
          name: "Settings",
          icon: Settings,
          show: hasPermission('settings:view'),
          children: [
            { name: "Settings", href: "/settings" },
          ]
        },
      ]
    }
  ].map(section => ({
    ...section,
    items: section.items.filter(item => item.show)
  })).filter(section => section.items.length > 0);

  const renderNavItem = (item: NavItem, isSubItem = false) => {
    const isParent = !!item.children;
    const isOpen = openMenus[item.name];
    const isActive = item.href ? pathname === item.href : item.children?.some(child => pathname === child.href);

    const content = (
      <div
        onMouseEnter={(e) => !isSubItem && handleItemMouseEnter(e, item)}
        onMouseLeave={(e) => !isSubItem && handleItemMouseLeave(e)}
        data-nav-item="true"
        className={cn(
          "group flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer relative",
          isActive ? "bg-slate-800/80 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/60",
          isCollapsed && !isSubItem && "justify-center px-0 mx-[-12px] rounded-none", // Make it full width in compact mode
          isSubItem && "pl-11 py-1 text-xs"
        )}
      >
        <item.icon size={isSubItem ? 14 : 20} className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-blue-500" : "group-hover:text-blue-400"
        )} />

        <span className={cn(
          "ml-3 truncate transition-all duration-300 whitespace-nowrap overflow-hidden",
          isCollapsed && !isSubItem ? "w-0 opacity-0" : "w-auto opacity-100"
        )}>
          {item.name}
        </span>

        {isParent && !isCollapsed && (
          <ChevronRight size={16} className={cn(
            "ml-auto transition-transform duration-200 text-slate-500",
            isOpen && "rotate-90"
          )} />
        )}
      </div>
    );

    if (isParent) {
      return (
        <div key={item.name} className="flex flex-col gap-1">
          <div onClick={() => !isCollapsed && toggleMenu(item.name)}>
            {content}
          </div>
          {isOpen && !isCollapsed && (
            <div className="flex flex-col gap-1">
              {item.children?.map(child => (
                <Link key={child.href} href={child.href} onClick={onNavigate}>
                  <div className={cn(
                    "flex items-center pl-11 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                    pathname === child.href ? "text-blue-400 bg-slate-800/40" : "text-slate-500 hover:text-white hover:bg-slate-800/40"
                  )}>
                    {child.name}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link key={item.name} href={item.href!} onClick={onNavigate}>
        {content}
      </Link>
    );
  };

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex flex-col h-full bg-slate-950 text-slate-300 border-r border-slate-800 transition-all duration-300 ease-in-out md:static",
        isCollapsed ? "w-[72px]" : "w-64 lg:w-72",
        className
      )}
    >
      {/* Workspace Selector */}
      <div className="p-4 border-b border-slate-800 h-[73px] flex items-center overflow-hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-auto py-2 px-1 hover:bg-slate-800 hover:text-white cursor-pointer transition-all",
                isCollapsed && "justify-center px-0"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded shrink-0 flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: activeWorkspace?.color_theme || '#0f766e' }}
                >
                  {activeWorkspace ? activeWorkspace.name.substring(0, 2).toUpperCase() : <Briefcase size={16} />}
                </div>
                <div className={cn(
                  "flex flex-col items-start truncate text-left transition-all duration-300 overflow-hidden",
                  isCollapsed ? "w-0 opacity-0 pointer-events-none" : "w-40 opacity-100"
                )}>
                  <span className="text-sm font-semibold truncate w-full text-white">
                    {loading ? "Loading..." : (activeWorkspace?.name || "No Workspace")}
                  </span>
                  <span className="text-xs text-slate-400 truncate w-full">
                    {activeWorkspace?.organization_name || "Workspaces"}
                  </span>
                </div>
              </div>
              {!isCollapsed && <ChevronDown className="ml-auto h-4 w-4 text-slate-400 shrink-0" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => switchWorkspace(workspace)}
                className={`${activeWorkspace?.id === workspace.id ? "bg-slate-100" : ""} cursor-pointer`}
              >
                <div
                  className="w-6 h-6 rounded mr-2 flex items-center justify-center text-white font-bold text-[10px]"
                  style={{ backgroundColor: workspace.color_theme || '#0f766e' }}
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

      {/* Navigation */}
      <div className="px-3 py-6 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="flex flex-col gap-5">
          {navigationSections.length > 0 ? (
            navigationSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-2">
                <h3 className={cn(
                  "text-[10px] uppercase tracking-[0.15em] text-slate-500 font-bold px-3 transition-all duration-300",
                  isCollapsed ? "opacity-0 h-0" : "opacity-100 h-auto mb-1"
                )}>
                  {section.title}
                </h3>
                <nav className="flex flex-col gap-1">
                  {section.items.map((item) => renderNavItem(item))}
                </nav>
              </div>
            ))
          ) : (
            <div className={cn(
              "px-3 py-4 flex flex-col items-center justify-center text-center gap-4 transition-all duration-300",
              isCollapsed && "px-1"
            )}>
              {!isCollapsed && (
                <>
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <Building2 size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">No content available</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Create an organization to unlock features.
                    </p>
                  </div>
                  <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 w-full text-xs">
                    <Link href="/organizations/new">Create Now</Link>
                  </Button>
                </>
              )}
              {isCollapsed && (
                <Link href="/organizations/new" className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <Plus size={16} className="text-blue-400" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Side-popup for compact mode (rendered outside the scrollable area) */}
      {isCollapsed && (hoveredItem || isHoveringPopup) && (
        <div
          className="fixed z-50 pointer-events-auto"
          data-side-popup="true"
          style={{
            top: (hoveredItem?.top ?? 0) - 8,
            left: 72 // Sit exactly at the edge
          }}
          onMouseEnter={() => setIsHoveringPopup(true)}
          onMouseLeave={(e) => {
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget?.closest('[data-nav-item="true"]')) {
              return;
            }
            setIsHoveringPopup(false);
            setHoveredItem(null);
          }}
        >
          {/* Hover bridge - ensures no gap between sidebar and popup */}
          <div className="absolute -left-2 top-0 bottom-0 w-2 h-full" />

          <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-2 min-w-[180px] overflow-hidden shadow-black/50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-800/50 mb-1">
              {(hoveredItem?.item.name || "")}
            </div>
            {hoveredItem?.item.href && (
              <Link
                href={hoveredItem.item.href}
                onClick={() => {
                  onNavigate?.();
                  setHoveredItem(null);
                  setIsHoveringPopup(false);
                }}
                className={cn("block px-3 py-2 text-sm hover:bg-slate-800 transition-colors font-medium", pathname === hoveredItem.item.href ? "text-blue-400" : "text-slate-300")}
              >
                View {hoveredItem.item.name}
              </Link>
            )}
            {hoveredItem?.item.children?.map(child => (
              <Link
                key={child.href}
                href={child.href}
                onClick={() => {
                  onNavigate?.();
                  setHoveredItem(null);
                  setIsHoveringPopup(false);
                }}
                className={cn("block px-3 py-2 text-sm hover:bg-slate-800 transition-colors font-medium", pathname === child.href ? "text-blue-400" : "text-slate-300")}
              >
                {child.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
