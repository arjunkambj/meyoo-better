export function parseAuthError(error: unknown): string {
  // Handle various error types
  if (!error) return "An unexpected error occurred";

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  // Parse Convex auth errors
  if (
    errorMessage.includes("InvalidAccountId") ||
    errorMessage.includes("retrieveAccount")
  ) {
    return "Invalid email or password";
  }

  if (errorMessage.includes("Uncaught Error")) {
    return "Authentication failed. Please try again";
  }

  if (errorMessage.includes("User already exists")) {
    return "An account with this email already exists";
  }

  if (
    errorMessage.includes("Invalid code") ||
    errorMessage.includes("expired")
  ) {
    return "Invalid or expired verification code";
  }

  if (errorMessage.includes("rate limit")) {
    return "Too many attempts. Please try again later";
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "Network error. Please check your connection";
  }

  if (errorMessage.includes("password")) {
    return "Invalid email or password";
  }

  // Default user-friendly message
  return "Something went wrong. Please try again";
}

export function getAuthErrorType(
  error: unknown,
): "credentials" | "network" | "rate_limit" | "exists" | "unknown" {
  if (!error) return "unknown";

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  if (
    errorMessage.includes("InvalidAccountId") ||
    errorMessage.includes("password")
  ) {
    return "credentials";
  }

  if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
    return "network";
  }

  if (errorMessage.includes("rate limit")) {
    return "rate_limit";
  }

  if (errorMessage.includes("already exists")) {
    return "exists";
  }

  return "unknown";
}
