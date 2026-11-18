import { useRouter } from 'expo-router';
import { type ReactNode, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../../shared/theme/theme';
import { ApiError, type Profile } from '../../auth/api';
import { useAuth } from '../../auth/AuthContext';
import { usePreview } from '../PreviewContext';

import { previewTeam as team, previewTimezone } from '../../matches/preview';
import { ActionButton, HomeScreen } from '../components/HomeScreen';

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
      <View style={styles.teamRow}>
        <View aria-hidden={true} style={styles.teamBadge}>
          <Text style={styles.badgeText}>AJ</Text>
        </View>
        <View style={styles.teamInfo}>
          <Text style={styles.cardTitle}>{team.name}</Text>
          <Text style={styles.description}>
            {team.modality} · {team.category}
          </Text>
        </View>
      </View>
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
      <HomeScreen
        title="Buscar times"
        description="A busca e a escolha de time estarão disponíveis após a integração do serviço de equipes."
      />
    );
  }

  return (
    <HomeScreen
      title="Buscar times"
      description="Encontre uma equipe pelo nome e siga para acompanhar seus jogos."
    >
      <TextInput
        accessibilityLabel="Nome do time"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Ex.: Ajax"
        placeholderTextColor={theme.colors.subtle}
        returnKeyType="search"
        style={styles.search}
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
      <HomeScreen
        title="Meus times"
        description="Sua lista de times estará disponível após a integração do serviço de equipes."
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
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{user.name}</Text>
        <Text style={styles.description}>{user.email}</Text>
        <Text style={styles.cardTitle}>Fuso horário</Text>
        <TextInput
          accessibilityLabel="Fuso horário"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          style={styles.search}
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
        />
      </View>
      {Boolean(notice) && (
        <Text accessibilityLiveRegion="polite" style={styles.description}>
          {notice}
        </Text>
      )}
      <ActionButton
        label="Sair"
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
  description: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
  search: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    color: theme.colors.text,
    fontSize: 16,
  },
  card: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
  },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  badgeText: { color: theme.colors.white, fontWeight: '800' },
  teamInfo: { flex: 1 },
  cardTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  following: { color: theme.colors.muted, fontSize: 16, fontWeight: '700' },
  empty: { color: theme.colors.muted, fontSize: 16, lineHeight: 23 },
});
