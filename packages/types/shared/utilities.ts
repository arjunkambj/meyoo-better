// Common utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ValueOf<T> = T[keyof T];

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
