type ReactNodeLike =
  | string
  | number
  | boolean
  | null
  | undefined
  | { [key: string]: unknown }
  | ReactNodeLike[];

// UI Component types
export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

export interface TableColumn<T = unknown> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: T) => ReactNodeLike;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange" | "number" | "boolean";
  options?: SelectOption[];
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
}
