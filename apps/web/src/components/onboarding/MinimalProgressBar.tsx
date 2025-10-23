"use client";

import { motion } from "framer-motion";

interface MinimalProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function MinimalProgressBar({
  currentStep,
  totalSteps,
}: MinimalProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full h-1.5 bg-default-100/60 relative overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-primary via-primary to-primary/90 relative"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Subtle glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </motion.div>
    </div>
  );
}