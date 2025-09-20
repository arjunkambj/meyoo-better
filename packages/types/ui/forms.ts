// Form types
export interface FormField {
  name: string;
  label: string;
  type:
    | "text"
    | "email"
    | "number"
    | "select"
    | "textarea"
    | "checkbox"
    | "radio";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}
