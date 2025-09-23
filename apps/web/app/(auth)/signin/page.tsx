import { AuthForm } from "@/components/auth/AuthForm";

interface SignInPageProps {
  searchParams: Promise<{ returnUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const returnUrl = params.returnUrl || "/overview";

  return (
    <div className="flex items-center bg-transparent justify-center min-h-screen p-4">
      <AuthForm mode="signin" returnUrl={returnUrl} />
    </div>
  );
}
