import { AuthForm } from "@/components/auth/AuthForm";

interface SignUpPageProps {
  searchParams: Promise<{ returnUrl?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const returnUrl = params.returnUrl || "/overview";

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <AuthForm mode="signup" returnUrl={returnUrl} />
    </div>
  );
}
