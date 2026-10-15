import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomNavigation } from 'react-native-paper';

// Material 3 navigation bar (3 to 5 destinations, labels always shown).
// Used as the `tabBar` of the Expo Router Tabs layout. Badge counts or dot indicators come from the caller.
export type AppTabBarProps = BottomTabBarProps & { badges?: Record<string, number | boolean | undefined> };

type TabRoute = { key: string; name: string; params?: any };

export function AppTabBar({ navigation, state, descriptors, insets, badges = {} }: AppTabBarProps) {
  const routes = (state.routes as TabRoute[]) || [];
  const visibleRoutes = routes.filter((route: TabRoute) => {
    const opts = descriptors[route.key]?.options;
    return (opts as any)?.href !== null && route.name !== 'index';
  });

  const activeRouteKey = state.routes[state.index]?.key;
  const activeIndex = visibleRoutes.findIndex((r: TabRoute) => r.key === activeRouteKey);
  const filteredIndex = activeIndex >= 0 ? activeIndex : 0;

  const filteredState = {
    ...state,
    index: filteredIndex,
    routes: visibleRoutes,
  };

  return (
    <BottomNavigation.Bar
      navigationState={filteredState as any}
      safeAreaInsets={insets}
      labeled
      onTabPress={({ route, preventDefault }: { route: any; preventDefault: () => void }) => {
        const navRoute = visibleRoutes.find((r: TabRoute) => r.key === route.key);
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (event.defaultPrevented) {
          preventDefault();
        } else if (navRoute) {
          navigation.navigate(navRoute.name, navRoute.params);
        }
      }}
      renderIcon={({ route, focused, color }: { route: any; focused: boolean; color: string }) => {
        const icon = descriptors[route.key]?.options.tabBarIcon;
        return icon ? (icon as any)({ focused, color, size: 24 }) : null;
      }}
      getLabelText={({ route }: { route: any }) => {
        const navRoute = routes.find((r: TabRoute) => r.key === route.key);
        const options = descriptors[route.key]?.options;
        return typeof options?.tabBarLabel === 'string'
          ? options.tabBarLabel
          : (options?.title ?? navRoute?.name ?? '');
      }}
      getBadge={({ route }: { route: any }) => {
        const navRoute = routes.find((r: TabRoute) => r.key === route.key);
        const b = navRoute ? badges[navRoute.name] : undefined;
        if (typeof b === 'number' && b > 0) return b;
        if (b === true) return true; // dot badge in React Native Paper
        return false;
      }}
      getAccessibilityLabel={({ route }: { route: any }) => {
        const navRoute = routes.find((r: TabRoute) => r.key === route.key);
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
