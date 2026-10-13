import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useActivityFeed, ActivityEvent } from './useActivityFeed';
import { lightTheme as theme, spacing, radii, typography, layout } from '../../ui/tokens';

interface ActivityFeedListProps {
  teamId: string;
}

export function ActivityFeedList({ teamId }: ActivityFeedListProps) {
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

  // Flatten all pages and de-duplicate by ID as a safety net
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

  // Guarded onEndReached: prevents duplicate page requests on fast scroll
  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // 1. Initial Loading State (Skeleton)
  if (isLoading) {
    return (
      <View style={styles.centerContainer} testID="feed-loading-skeleton">
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading activity feed...</Text>
      </View>
    );
  }

  // 2. Error State with Retry
  if (isError) {
    return (
      <View style={styles.centerContainer} testID="feed-error-state">
        <Text style={styles.errorTitle}>Unable to load activity feed</Text>
        <Text style={styles.errorSubtitle}>{(error as any)?.message || 'Network error'}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading activity feed"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 3. Empty State
  if (events.length === 0) {
    return (
      <View style={styles.centerContainer} testID="feed-empty-state">
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptySubtitle}>Team shifts and swap updates will appear here.</Text>
      </View>
    );
  }

  // List Footer Component
  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={styles.footerContainer} testID="feed-footer-loading">
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.footerLoadingText}>Loading more...</Text>
        </View>
      );
    }
    if (!hasNextPage && events.length > 0) {
      return (
        <View style={styles.footerContainer} testID="feed-footer-end">
          <Text style={styles.footerEndText}>You are all caught up</Text>
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

    let eventDescription = item.type.replace(/_/g, ' ');
    if (item.payload?.label) {
      eventDescription += `: "${item.payload.label}"`;
    }

    return (
      <View style={styles.itemCard} testID={`feed-item-${item.id}`}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemType}>{item.type.toUpperCase()}</Text>
          <Text style={styles.itemTime}>{formattedDate}</Text>
        </View>
        <Text style={styles.itemDescription}>{eventDescription}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlashList
        data={events}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={76}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: theme.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: theme.textSecondary,
    fontSize: typography.sizes.sm,
  },
  errorTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: theme.danger,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    fontSize: typography.sizes.sm,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: layout.minTouchTarget,
    minWidth: layout.minTouchTarget * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: theme.textInverse,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: theme.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  itemCard: {
    backgroundColor: theme.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xxs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  itemType: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: theme.primary,
    letterSpacing: 0.5,
  },
  itemTime: {
    fontSize: typography.sizes.xs,
    color: theme.textMuted,
  },
  itemDescription: {
    fontSize: typography.sizes.sm,
    color: theme.textPrimary,
  },
  footerContainer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoadingText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: theme.textMuted,
  },
  footerEndText: {
    fontSize: typography.sizes.xs,
    color: theme.textMuted,
  },
});
