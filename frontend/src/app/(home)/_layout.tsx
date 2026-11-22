import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgendaTeam } from '../../features/matches/hooks';
import { TabIcon } from '../../features/home/components/TabIcon';
import { theme } from '../../shared/theme/theme';

export default function HomeLayout() {
  const { bottom } = useSafeAreaInsets();
  const hasActiveTeam = Boolean(useAgendaTeam());

  return (
    <Tabs
      initialRouteName={hasActiveTeam ? 'agenda' : 'buscar'}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarActiveBackgroundColor: theme.colors.accentSurface,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.surfaceBorder,
          height: 60 + bottom,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 3,
          marginVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color }) => <TabIcon name="agenda" color={color} />,
        }}
      />
      <Tabs.Screen
        name="buscar"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <TabIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="meus-times"
        options={{
          title: 'Meus times',
          tabBarIcon: ({ color }) => <TabIcon name="teams" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} />,
        }}
      />
    </Tabs>
  );
}
