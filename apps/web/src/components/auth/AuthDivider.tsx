"use client";

import React from "react";

interface AuthDividerProps {
  text?: string;
}

export const AuthDivider = React.memo(function AuthDivider({
  text = "or",
}: AuthDividerProps) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-default-200" />
      <p className="shrink-0 text-tiny text-default-500 uppercase font-medium tracking-wide">
        {text}
      </p>
      <div className="flex-1 h-px bg-default-200" />
    </div>
  );
});
