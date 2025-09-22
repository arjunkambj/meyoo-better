"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/libs/utils";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  onSearch,
  placeholder = "Search conversations...",
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  const handleChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  return (
    <div
      className={cn(
        "relative flex items-center",
        "border rounded-lg transition-colors",
        isFocused ? "border-default-400" : "border-default-200",
        className
      )}
    >
      <Icon
        icon="solar:magnifer-linear"
        width={16}
        className="absolute left-3 text-default-400"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-transparent",
          "pl-9 pr-8 py-2",
          "text-sm placeholder:text-default-400",
          "focus:outline-none"
        )}
      />
      {query && (
        <button
          onClick={handleClear}
          className={cn(
            "absolute right-2 p-1",
            "text-default-400 hover:text-default-600",
            "transition-colors"
          )}
        >
          <Icon icon="solar:close-circle-linear" width={16} />
        </button>
      )}
    </div>
  );
}