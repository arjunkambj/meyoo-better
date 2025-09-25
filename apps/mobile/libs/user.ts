export type BasicUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export function getUserDisplayName(user?: BasicUser | null, fallback = "Team member") {
  if (!user) return fallback;
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split("@")[0];
  return fallback;
}

export function getUserInitials(user?: BasicUser | null) {
  if (!user) return "M";
  const name = user.name?.trim();
  if (name) {
    const parts = name.split(/\s+/);
    const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
    return initials || "M";
  }
  const email = user.email?.trim();
  if (email) {
    return email[0]?.toUpperCase() ?? "M";
  }
  return "M";
}

export function getUserRoleLabel(user?: BasicUser | null) {
  const role = user?.role;
  if (!role) return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}
