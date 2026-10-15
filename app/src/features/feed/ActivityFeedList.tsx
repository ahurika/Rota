import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  ActivityIndicator,
  Button,
  useTheme,
  Surface,
} from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { useActivityFeed, ActivityEvent } from './useActivityFeed';
import { spacing, radii } from '../../ui/tokens';

interface ActivityFeedListProps {
  teamId: string;
}

function getEventIcon(type: string): { icon: string; bgVariant: 'primary' | 'secondary' | 'tertiary' } {
  if (type.includes('shift')) return { icon: 'calendar-clock', bgVariant: 'primary' };
  if (type.includes('swap')) return { icon: 'swap-horizontal', bgVariant: 'secondary' };
  if (type.includes('member') || type.includes('invite')) return { icon: 'account-plus', bgVariant: 'tertiary' };
  if (type.includes('bill') || type.includes('sub')) return { icon: 'credit-card-outline', bgVariant: 'primary' };
  return { icon: 'bell-outline', bgVariant: 'secondary' };
}

export function ActivityFeedList({ teamId }: ActivityFeedListProps) {
  const theme = useTheme();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useActivityFeed(teamId);

  // Flatten all pages and de-duplicate by ID
  const events = useMemo(() => {
    if (!data?.pages) return [];
    const map = new Map<string, ActivityEvent>();
    for (const page of data.pages) {
      for (const item of page.items) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [data]);

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // 1. Initial Loading State
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]} testID="feed-loading-skeleton">
        <ActivityIndicator size="large" animating color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ marginTop: spacing.md, color: theme.colors.onSurfaceVariant }}>
          Loading activity feed...
        </Text>
      </View>
    );
  }

  // 2. Error State with Retry
  if (isError) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]} testID="feed-error-state">
        <Surface
          style={[
            styles.stateCard,
            { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
          ]}
          elevation={1}
        >
          <Avatar.Icon size={48} icon="alert-circle-outline" style={{ backgroundColor: theme.colors.errorContainer }} color={theme.colors.onErrorContainer} />
          <Text variant="titleMedium" style={{ color: theme.colors.error, fontWeight: '700', marginTop: spacing.md }}>
            Unable to load activity feed
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
            {(error as any)?.message || 'Network error'}
          </Text>
          <Button
            mode="contained-tonal"
            icon="refresh"
            style={{ marginTop: spacing.md }}
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading activity feed"
          >
            Retry
          </Button>
        </Surface>
      </View>
    );
  }

  // 3. Empty State
  if (events.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]} testID="feed-empty-state">
        <Surface
          style={[
            styles.stateCard,
            { backgroundColor: theme.colors.elevation.level1, borderColor: theme.colors.outlineVariant },
          ]}
          elevation={1}
        >
          <Avatar.Icon size={48} icon="bell-sleep-outline" style={{ backgroundColor: theme.colors.surfaceVariant }} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontWeight: '700', marginTop: spacing.md }}>
            No activity yet
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
            Shift publishes, swaps, and roster changes will appear here.
          </Text>
        </Surface>
      </View>
    );
  }

  // List Footer Component
  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerContainer} testID="feed-footer-loading">
          <ActivityIndicator size="small" animating color={theme.colors.primary} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
            Loading older events...
          </Text>
        </View>
      );
    }
    if (!hasNextPage && events.length > 0) {
      return (
        <View style={styles.footerContainer} testID="feed-footer-end">
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            All caught up
          </Text>
        </View>
      );
    }
    return null;
  };

  // Render individual event item
  const renderItem = ({ item }: { item: ActivityEvent }) => {
    const formattedDate = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const formattedFullDate = new Date(item.created_at).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });

    const { icon } = getEventIcon(item.type);
    let eventTitle = item.type.replace(/_/g, ' ');
    eventTitle = eventTitle.charAt(0).toUpperCase() + eventTitle.slice(1);

    const description = item.payload?.label
      ? `Shift: ${item.payload.label}`
      : item.payload?.note || `Event on team`;

    return (
      <Card
        style={[
          styles.eventCard,
          {
            backgroundColor: theme.colors.elevation.level1,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
        mode="elevated"
        testID={`activity-item-${item.id}`}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardRow}>
            <Avatar.Icon
              size={40}
              icon={icon}
              style={{
                backgroundColor: theme.colors.primaryContainer,
              }}
              color={theme.colors.onPrimaryContainer}
            />

            <View style={styles.infoCol}>
              <View style={styles.headerRow}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
                  {eventTitle}
                </Text>
                <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                  {formattedFullDate} · {formattedDate}
                </Text>
              </View>

              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                {description}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
          Activity
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
          Real-time updates across the team
        </Text>
      </View>

      <FlashList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eventCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateCard: {
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  footerContainer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
