import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomNavigation } from 'react-native-paper';

// Material 3 navigation bar (3 to 5 destinations, labels always shown).
// Used as the `tabBar` of the Expo Router Tabs layout. Badge counts come from the caller.
export type AppTabBarProps = BottomTabBarProps & { badges?: Record<string, number | undefined> };

export function AppTabBar({ navigation, state, descriptors, insets, badges = {} }: AppTabBarProps) {
  return (
    <BottomNavigation.Bar
      navigationState={state as any}
      safeAreaInsets={insets}
      labeled
      onTabPress={({ route, preventDefault }) => {
        const navRoute = state.routes.find((r) => r.key === route.key);
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event.defaultPrevented) {
          preventDefault();
        } else if (navRoute) {
          navigation.navigate(navRoute.name, navRoute.params);
        }
      }}
      renderIcon={({ route, focused, color }) => {
        const icon = descriptors[route.key]?.options.tabBarIcon;
        return icon ? icon({ focused, color, size: 24 }) : null;
      }}
      getLabelText={({ route }) => {
        const navRoute = state.routes.find((r) => r.key === route.key);
        const options = descriptors[route.key]?.options;
        return typeof options?.tabBarLabel === 'string'
          ? options.tabBarLabel
          : (options?.title ?? navRoute?.name ?? '');
      }}
      getBadge={({ route }) => {
        const navRoute = state.routes.find((r) => r.key === route.key);
        const n = navRoute ? badges[navRoute.name] : undefined;
        return n && n > 0 ? n : false;
      }}
      getAccessibilityLabel={({ route }) => {
        const navRoute = state.routes.find((r) => r.key === route.key);
        const name = navRoute?.name ?? '';
        const n = badges[name];
        const options = descriptors[route.key]?.options;
        const label = typeof options?.tabBarLabel === 'string'
          ? options.tabBarLabel
          : (options?.title ?? name);
        return n && n > 0 ? `${label}, ${n} pending` : label;
      }}
    />
  );
}
