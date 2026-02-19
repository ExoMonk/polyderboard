import type { Variants } from "motion/react";

// Page-level fade+slide
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const pageTransition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
};

// Staggered container for lists/grids
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

// Individual stagger child
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Stat card entrance (scale + fade)
export const statCardVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

// Table row entrance (slide from left)
export const tableRowVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
};

// Alert card entrance (slide from top + scale)
export const alertCardVariants: Variants = {
  initial: { opacity: 0, y: -20, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 50, transition: { duration: 0.2 } },
};

// Glass panel entrance
export const panelVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

// Hover glow pulse for interactive elements
export const hoverGlow = {
  scale: 1.02,
  boxShadow: "0 0 20px rgba(59,130,246,0.15), 0 0 40px rgba(249,115,22,0.08)",
  transition: { duration: 0.2 },
};

// Button press
export const tapScale = { scale: 0.97 };
