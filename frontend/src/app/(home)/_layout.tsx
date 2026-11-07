import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from '../../features/home/components/TabIcon';
import { theme } from '../../shared/theme/theme';

export default function HomeLayout() {
  const { bottom } = useSafeAreaInsets();

  return (
    <Tabs
      initialRouteName="buscar"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 12 },
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          height: 60 + bottom,
        },
      }}
    >
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
