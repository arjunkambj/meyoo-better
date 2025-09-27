import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react';
import { Redirect, useRouter } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { View } from 'react-native';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';

export default function AuthScreen() {
  const router = useRouter();

  return (
    <>
      <AuthLoading>
        <View className="flex-1 items-center justify-center bg-background">
          <View className="w-full max-w-sm gap-4 px-6">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-12 rounded-2xl" />
          </View>
        </View>
      </AuthLoading>

      <Authenticated>
        <Redirect href="/(tabs)/overview" />
      </Authenticated>

      <Unauthenticated>
        <AuthLayout
          title="Welcome to Meyoo"
          subtitle="Sign in or create an account to continue"
        >
          <AuthForm onSuccess={() => router.replace('/(tabs)/overview')} />
        </AuthLayout>
      </Unauthenticated>
    </>
  );
}
