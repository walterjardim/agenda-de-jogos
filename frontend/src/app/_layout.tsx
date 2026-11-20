import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { SessionStatusScreen } from '../features/auth/screens/SessionStatusScreen';
import { PreviewContext } from '../features/home/PreviewContext';
import { usePreviewTeamData } from '../features/home/usePreviewTeamData';

function Navigation() {
  const { session, restoring, restoreFailed, retryRestore } = useAuth();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [followingAjax, setFollowingAjax] = useState(false);
  const [selectedPreviewTeam, setSelectedPreviewTeam] = useState(false);
  const { resetPreviewData, ...previewData } = usePreviewTeamData();
  const canOpenHome = Boolean(session) || (__DEV__ && previewOpen);

  function closePreview() {
    setFollowingAjax(false);
    setSelectedPreviewTeam(false);
    resetPreviewData();
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
        setFollowingAjax: (following) => {
          setFollowingAjax(following);
          if (!following) setSelectedPreviewTeam(false);
        },
        selectedPreviewTeam,
        choosePreviewTeam: () => setSelectedPreviewTeam(true),
        ...previewData,
      }}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!canOpenHome}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={canOpenHome}>
          <Stack.Screen name="(home)" />
          <Stack.Screen name="trocar-time" />
          <Stack.Screen name="novo-jogo" />
          <Stack.Screen name="jogo/[id]" />
          <Stack.Screen name="editar-jogo/[id]" />
          <Stack.Screen name="convocacao/[id]" />
          <Stack.Screen name="compartilhar/[id]" />
          <Stack.Screen name="elenco" />
          <Stack.Screen name="competicoes" />
          <Stack.Screen name="atleta" />
          <Stack.Screen name="competicao" />
          <Stack.Screen name="uniformes" />
          <Stack.Screen name="uniforme" />
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
