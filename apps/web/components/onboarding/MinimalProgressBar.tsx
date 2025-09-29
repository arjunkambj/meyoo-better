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
    <div className="w-full h-1 bg-default-100">
      <motion.div
        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-r-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  );
}