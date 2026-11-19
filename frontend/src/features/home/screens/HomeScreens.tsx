import { useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormField, FormInput } from '../../../shared/components/FormInput';
import { surfaces } from '../../../shared/theme/surfaces';
import { TeamIdentity } from '../../teams/TeamIdentity';
import { theme } from '../../../shared/theme/theme';
import { ApiError, type Profile } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { ManageTeamsScreen } from '../../teams/ManageTeamsScreen';
import { ChooseTeamScreen } from '../../teams/ChooseTeamScreen';
import { usePreview } from '../PreviewContext';

import { previewTeam as team, previewTimezone } from '../../matches/preview';
import { ActionButton } from '../../../shared/components/ActionButton';
import { HomeScreen } from '../components/HomeScreen';
import { TabIcon } from '../components/TabIcon';

function ChoosePreviewTeam() {
  const router = useRouter();
  const { choosePreviewTeam } = usePreview();

  return (
    <ActionButton
      label="Escolher time"
      primary
      onPress={() => {
        choosePreviewTeam();
        router.navigate('/agenda');
      }}
    />
  );
}

function TeamCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      <TeamIdentity
        name={team.name}
        description={`${team.modality} · ${team.category}`}
      />
      {children}
    </View>
  );
}

export function SearchTeamsScreen() {
  const [query, setQuery] = useState('');
  const { followingAjax, setFollowingAjax } = usePreview();
  const matches = team.name.toLowerCase().includes(query.trim().toLowerCase());
  const { session } = useAuth();

  if (session) {
    return (
      <ChooseTeamScreen
        key={session.sessionToken}
        token={session.sessionToken}
      />
    );
  }

  return (
    <HomeScreen
      title="Buscar times"
      description="Encontre uma equipe pelo nome e siga para acompanhar seus jogos."
    >
      <FormInput
        accessibilityLabel="Nome do time"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Ex.: Ajax"
        returnKeyType="search"
        value={query}
        onChangeText={setQuery}
      />
      {matches ? (
        <TeamCard>
          {followingAjax ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.following}>
                Seguindo
              </Text>
              <ChoosePreviewTeam />
            </>
          ) : (
            <ActionButton
              label="Seguir"
              onPress={() => setFollowingAjax(true)}
              primary
            />
          )}
        </TeamCard>
      ) : (
        <Text accessibilityLiveRegion="polite" style={styles.empty}>
          Nenhum time encontrado. Tente outro nome.
        </Text>
      )}
    </HomeScreen>
  );
}

export function MyTeamsScreen() {
  const { followingAjax, setFollowingAjax } = usePreview();
  const { session } = useAuth();

  if (session) {
    return (
      <ManageTeamsScreen
        key={session.sessionToken}
        token={session.sessionToken}
      />
    );
  }

  return (
    <HomeScreen
      title="Meus times"
      description="Veja aqui as equipes que você segue nesta prévia."
    >
      {followingAjax ? (
        <TeamCard>
          <ChoosePreviewTeam />
          <ActionButton
            label="Deixar de seguir"
            onPress={() => setFollowingAjax(false)}
          />
        </TeamCard>
      ) : (
        <Text accessibilityLiveRegion="polite" style={styles.empty}>
          Você ainda não segue nenhum time. Use a aba Buscar para encontrar uma
          equipe.
        </Text>
      )}
    </HomeScreen>
  );
}

function ProfilePreviewScreen() {
  const { closePreview } = usePreview();

  return (
    <HomeScreen
      title="Perfil"
      description="Você está na prévia, sem uma conta conectada."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fuso horário</Text>
        <Text style={styles.description}>{previewTimezone}</Text>
      </View>
      <ActionButton label="Sair da prévia" onPress={closePreview} />
    </HomeScreen>
  );
}

function AccountProfile({ user }: { user: Profile }) {
  const { signOut, saveTimezone } = useAuth();
  const [timezone, setTimezone] = useState(user.timezone);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  async function submit(action: 'save' | 'logout') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (action === 'logout') {
        await signOut();
      } else {
        await saveTimezone(timezone.trim());
        setNotice('Fuso horário salvo.');
      }
    } catch (error) {
      if (action === 'logout') {
        setNotice(
          'Não foi possível encerrar a sessão. Confira a conexão e tente novamente.',
        );
      } else if (error instanceof ApiError && error.status === 400) {
        setNotice(
          'Informe um fuso horário IANA válido, como America/Sao_Paulo.',
        );
      } else {
        setNotice('Não foi possível salvar o fuso horário. Tente novamente.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <HomeScreen
      title="Perfil"
      description="Gerencie as preferências da sua conta."
    >
      <View style={[styles.card, surfaces.highlighted, styles.account]}>
        <View style={styles.avatar}>
          <TabIcon name="profile" color={theme.colors.white} />
        </View>
        <View style={styles.accountDetails}>
          <Text style={styles.cardTitle}>{user.name}</Text>
          <Text style={styles.description}>{user.email}</Text>
        </View>
      </View>
      <View style={styles.card}>
        <FormField
          label="Fuso horário"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          value={timezone}
          onChangeText={setTimezone}
        />
        <ActionButton
          label="Salvar"
          onPress={() => void submit('save')}
          disabled={
            busy || !timezone.trim() || timezone.trim() === user.timezone
          }
          primary
          fullWidth
        />
      </View>
      {Boolean(notice) && (
        <Text accessibilityLiveRegion="polite" style={styles.description}>
          {notice}
        </Text>
      )}
      <ActionButton
        label="Sair"
        destructive
        onPress={() => void submit('logout')}
        disabled={busy}
      />
    </HomeScreen>
  );
}

export function ProfileScreen() {
  const { session } = useAuth();
  return session ? (
    <AccountProfile key={session.user.id} user={session.user} />
  ) : (
    <ProfilePreviewScreen />
  );
}

const styles = StyleSheet.create({
  description: surfaces.text,
  card: surfaces.card,
  cardTitle: surfaces.title,
  account: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  accountDetails: { flex: 1 },
  following: { color: theme.colors.accent, fontSize: 15, fontWeight: '700' },
  empty: surfaces.text,
});
