/**
 * Brand colors a business can pick for its invoices (document, PDF and email).
 * Each one passes WCAG AA as text on white and as a background behind white text.
 */
export const ACCENT_COLORS = {
  oak: { label: "Oak green", hex: "#2f5d4e", soft: "#e3ece7" },
  ink: { label: "Ink blue", hex: "#2b4a8b", soft: "#e4e9f4" },
  terracotta: { label: "Terracotta", hex: "#9c4221", soft: "#f6e7df" },
  plum: { label: "Plum", hex: "#6b3a68", soft: "#efe5ee" },
  graphite: { label: "Graphite", hex: "#33363b", soft: "#e8e9eb" },
} as const;

export type AccentColor = keyof typeof ACCENT_COLORS;

export const ACCENT_COLOR_KEYS = Object.keys(ACCENT_COLORS) as [AccentColor, ...AccentColor[]];

export const DEFAULT_ACCENT_COLOR: AccentColor = "oak";
