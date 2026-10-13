import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomNavigation } from 'react-native-paper';

// Material 3 navigation bar (3 to 5 destinations, labels always shown).
// Used as the `tabBar` of the Expo Router Tabs layout. Badge counts or dot indicators come from the caller.
export type AppTabBarProps = BottomTabBarProps & { badges?: Record<string, number | boolean | undefined> };

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
        const b = navRoute ? badges[navRoute.name] : undefined;
        if (typeof b === 'number' && b > 0) return b;
        if (b === true) return true; // dot badge in React Native Paper
        return false;
      }}
      getAccessibilityLabel={({ route }) => {
        const navRoute = state.routes.find((r) => r.key === route.key);
        const name = navRoute?.name ?? '';
        const b = badges[name];
        const options = descriptors[route.key]?.options;
        const label = typeof options?.tabBarLabel === 'string'
          ? options.tabBarLabel
          : (options?.title ?? name);
        if (typeof b === 'number' && b > 0) return `${label}, ${b} pending`;
        if (b === true) return `${label}, attention needed`;
        return label;
      }}
    />
  );
}
