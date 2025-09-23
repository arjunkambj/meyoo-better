// Design System Constants for Landing Page
export const designSystem = {
  // Section spacing
  spacing: {
    section: "py-20 sm:py-24 lg:py-24", // Consistent section padding
    container: "container mx-auto px-4 sm:px-6 lg:px-8", // Standard container
    gap: {
      sm: "gap-4",
      md: "gap-6",
      lg: "gap-8",
      xl: "gap-12",
    },
  },

  // Typography
  typography: {
    sectionLabel:
      "text-center mb-4 text-xs uppercase tracking-[0.15em] font-medium text-primary/70",
    sectionChip:
      "inline-flex items-center gap-2 bg-primary/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6",
    sectionTitle:
      "text-center text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl",
    sectionSubtitle:
      "mt-4 max-w-2xl mx-auto text-center text-base sm:text-lg text-muted-foreground",
    cardTitle: "text-xl font-semibold tracking-tight",
    cardDescription: "text-muted-foreground text-sm leading-relaxed",
  },

  // Card styling
  card: {
    base: "bg-gradient-to-br from-default-100 to-default-100/50 border border-default-200/20",
  },

  // Background patterns
  background: {
    gradient: "bg-gradient-to-b from-background via-primary/4 to-background ",
    mesh: "absolute inset-0 -z-10 opacity-30",
    pattern: `
      background-image: linear-gradient(to right, rgba(99,102,241,0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99,102,241,0.08) 1px, transparent 1px);
      background-size: 80px 80px;
    `,
  },

  // Animation
  animation: {
    fadeInUp: "animate-fade-in-up",
    fadeIn: "animate-fade-in",
    duration: "transition-all duration-300",
  },

  // Colors (consistent opacity)
  colors: {
    mutedBg: "bg-muted/40",
    primaryAccent: "text-primary",
    borderLight: "border-default-200/20",
  },
} as const;
