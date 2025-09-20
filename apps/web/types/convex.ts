// Minimal Convex type shims for the web app to avoid importing backend types

export type Id<TableName extends string = string> = string & {
  __table?: TableName;
};

export type Doc<TableName extends string = string> = {
  _id?: Id<TableName>;
  _creationTime?: number;
  // Allow arbitrary fields; narrow in-app where needed
  [key: string]: unknown;
};

