import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { usePreview } from '../features/home/PreviewContext';

export default function LoginRoute() {
  const { openPreview } = usePreview();

  return <LoginScreen onOpenPreview={__DEV__ ? openPreview : undefined} />;
}
