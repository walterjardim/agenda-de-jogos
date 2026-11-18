import { Redirect } from 'expo-router';
import { useAuth } from '../features/auth/AuthContext';
import { ChooseTeamScreen } from '../features/teams/ChooseTeamScreen';

export default function ChangeTeamRoute() {
  const { session } = useAuth();
  return session ? (
    <ChooseTeamScreen
      key={session.sessionToken}
      token={session.sessionToken}
      mine
    />
  ) : (
    <Redirect href="/meus-times" />
  );
}
