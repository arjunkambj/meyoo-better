import type React from "react";

import AuthLayoutClient from "../../components/auth/AuthLayoutClient";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>;
}
