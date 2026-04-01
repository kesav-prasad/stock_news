import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanies, Company } from '@/hooks/useApi';
import { useWatchlist } from '@/hooks/useWatchlist';
import StockCard from '@/components/StockCard';
import CompanyModal from '@/components/CompanyModal';

export default function WatchlistScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Fetch all companies (no exchange filter for watchlist)
  const { companies, loading, refetch } = useCompanies('', '');
  const { watchlistIds, toggleWatchlist, isInWatchlist, watchlistCount, clearWatchlist, hydrated } =
    useWatchlist();

  // Filter to only watchlisted companies
  const watchlistCompanies = useMemo(() => {
    let filtered = companies.filter((c) => watchlistIds.has(c.id));
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.symbol.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [companies, watchlistIds, searchTerm]);

  const numColumns = width > 600 ? 3 : width > 400 ? 2 : 1;

  const handleClearAll = () => {
    Alert.alert(
      'Clear Watchlist',
      `Remove all ${watchlistCount} companies from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearWatchlist,
        },
      ]
    );
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Company; index: number }) => (
      <Animated.View
        entering={FadeInDown.delay(index * 50).duration(300)}
        style={[styles.cardWrapper, { flex: 1 / numColumns, maxWidth: `${100 / numColumns}%` as any }]}
      >
        <StockCard
          company={item}
          onPress={setSelectedCompany}
          isWatchlisted={isInWatchlist(item.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      </Animated.View>
    ),
    [numColumns, isInWatchlist, toggleWatchlist]
  );

  const keyExtractor = useCallback((item: Company) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top + Spacing.sm,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Watchlist
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {hydrated
                ? `${watchlistCount} company${watchlistCount !== 1 ? 'ies' : ''} saved`
                : 'Loading...'}
            </Text>
          </View>
          {watchlistCount > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={colors.red} />
              <Text style={[styles.clearText, { color: colors.red }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search */}
        {watchlistCount > 0 && (
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search watchlist..."
              placeholderTextColor={colors.textTertiary}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchTerm('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.6}
              >
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      {!hydrated || (loading && companies.length === 0) ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : watchlistCount === 0 ? (
        <View style={styles.centerContainer}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="star" size={36} color={colors.amber} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Your watchlist is empty
            </Text>
            <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>
              Tap the ♥ icon on any company card to add it to your watchlist for quick access.
            </Text>
          </Animated.View>
        </View>
      ) : (
        <FlatList
          data={watchlistCompanies}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          key={`cols-${numColumns}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
                No matching companies in watchlist
              </Text>
            </View>
          }
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      {/* Company Modal */}
      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          isWatchlisted={isInWatchlist(selectedCompany.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  clearText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
    paddingVertical: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 280,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  emptyMessage: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  noResultsText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    marginTop: Spacing.md,
  },
  listContent: {
    padding: Spacing.sm,
  },
  cardWrapper: {
    padding: Spacing.xs,
  },
});
