// Permission types
export type Permission =
  | "view_all"
  | "edit_all"
  | "manage_team"
  | "manage_settings"
  | "manage_integrations"
  | "export_data"
  | "delete_data";

export interface PermissionCheck {
  required: Permission[];
  any?: boolean; // true = any permission, false = all permissions
}
