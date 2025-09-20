export const LAYOUT_STYLES = {
  // Main Layout
  mainContainer: "flex h-screen w-full dark:bg-background bg-content2/40 py-6",
  
  // Sidebar
  sidebar: {
    container: "h-full",
    drawer: "max-w-[260px] w-[260px] bg-content1 border-r border-default-100 shadow-none p-0",
    content: "relative flex h-full max-w-[260px] flex-1 flex-col bg-content1 rounded-2xl border border-divider",
    contentPadding: "p-5",
    collapsed: "w-0 p-0 opacity-0 overflow-hidden",
    expanded: "w-[260px] p-5 opacity-100 overflow-visible ml-4",
  },
  
  // Main Content
  main: {
    container: "flex flex-col min-w-0 w-full",
    header: "px-6",
    content: "flex-1 pt-6 px-8 overflow-auto",
  },
  
  // Navigation Items
  navItem: {
    base: "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 min-h-9",
    active: "bg-primary/10 text-primary font-medium",
    inactive: "text-default-600 hover:text-default-900 hover:bg-default-100",
  },
  
  // Icons
  icon: {
    size: {
      small: 20,
      default: 22,
      large: 24,
    },
    className: "shrink-0 transition-colors",
  },
  
  // Typography
  text: {
    menuLabel: "text-sm font-medium truncate",
    sectionTitle: "text-xs font-semibold text-default-500 uppercase tracking-wider px-3 mb-2",
    footer: "text-xs text-default-400",
  },
  
  // Badge
  badge: {
    default: "bg-danger text-white text-xs px-2 py-0.5 rounded-full",
    warning: "bg-warning text-white text-xs px-2 py-0.5 rounded-full",
    success: "bg-success text-white text-xs px-2 py-0.5 rounded-full",
  },
} as const;

export const TRANSITIONS = {
  default: "transition-all duration-200",
  sidebar: "transition-all duration-300 ease-in-out",
  hover: "transition-colors duration-150",
} as const;