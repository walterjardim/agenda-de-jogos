import { Redirect } from 'expo-router';
import { useAuth } from '../features/auth/AuthContext';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { usePreview } from '../features/home/PreviewContext';

export default function LoginRoute() {
  const { openPreview, previewOpen, selectedPreviewTeam } = usePreview();
  const { session } = useAuth();

  if (session || previewOpen) {
    const hasTeam = session
      ? Boolean(session.user.activeTeamId)
      : selectedPreviewTeam;
    return <Redirect href={hasTeam ? '/agenda' : '/buscar'} />;
  }

  return <LoginScreen onOpenPreview={__DEV__ ? openPreview : undefined} />;
}
