import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { PreviewContext } from '../features/home/PreviewContext';

export default function RootLayout() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [followingAjax, setFollowingAjax] = useState(false);
  const canOpenHome = __DEV__ && previewOpen;

  function closePreview() {
    setFollowingAjax(false);
    setPreviewOpen(false);
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
      <StatusBar style="dark" />
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
