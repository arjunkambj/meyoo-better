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
    <div className="w-full h-0.5 bg-default-100">
      <motion.div
        className="h-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}