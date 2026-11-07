import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { SessionStatusScreen } from '../features/auth/screens/SessionStatusScreen';
import { PreviewContext } from '../features/home/PreviewContext';

function Navigation() {
  const { session, restoring, restoreFailed, retryRestore } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [followingAjax, setFollowingAjax] = useState(false);
  const canOpenHome = Boolean(session) || (__DEV__ && previewOpen);

  function closePreview() {
    setFollowingAjax(false);
    setPreviewOpen(false);
  }

  if (restoring || restoreFailed) {
    return (
      <SessionStatusScreen retry={restoreFailed ? retryRestore : undefined} />
    );
  }

  return (
    <PreviewContext.Provider
      value={{
        openPreview: () => setPreviewOpen(true),
        closePreview,
        followingAjax,
        setFollowingAjax,
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!canOpenHome}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={canOpenHome}>
          <Stack.Screen name="(home)" />
        </Stack.Protected>
      </Stack>
    </PreviewContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Navigation />
    </AuthProvider>
  );
}
