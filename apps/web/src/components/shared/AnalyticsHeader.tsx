"use client";

import type { ReactNode } from "react";

interface AnalyticsHeaderProps {
  title?: string;
  description?: string;
  icon?: string;
  children?: ReactNode;
  actions?: ReactNode; // Deprecated: use rightActions instead
  leftActions?: ReactNode;
  rightActions?: ReactNode;
}

export function AnalyticsHeader({
  title: _title,
  description: _description,
  icon: _icon,
  children,
  actions,
  leftActions,
  rightActions,
}: AnalyticsHeaderProps) {
  // For backward compatibility, use actions as rightActions if rightActions is not provided
  const right = rightActions || actions;

  return (
    <div className="flex items-center justify-between mb-6">
      {leftActions ? (
        <div className="flex items-center gap-2">{leftActions}</div>
      ) : (
        <div />
      )}
      {right && <div className="flex items-center gap-2">{right}</div>}
      {children}
    </div>
  );
}
