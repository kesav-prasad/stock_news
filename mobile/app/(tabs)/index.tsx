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
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanies, Company } from '@/hooks/useApi';
import { useSharedWatchlist } from '@/contexts/WatchlistContext';
import StockCard from '@/components/StockCard';
import CompanyModal from '@/components/CompanyModal';

const EXCHANGE_OPTIONS = ['', 'NSE', 'BSE'] as const;

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [searchTerm, setSearchTerm] = useState('');
  const [exchange, setExchange] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { companies, total, loading, error, refetch } = useCompanies(searchTerm, exchange);
  const { toggleWatchlist, isInWatchlist } = useSharedWatchlist();

  // Determine number of columns based on screen width
  const numColumns = width > 600 ? 3 : width > 400 ? 2 : 1;

  const renderItem = useCallback(
    ({ item }: { item: Company }) => (
      <View style={[styles.cardWrapper, { flex: 1 / numColumns, maxWidth: `${100 / numColumns}%` as any }]}>
        <StockCard
          company={item}
          onPress={setSelectedCompany}
          isWatchlisted={isInWatchlist(item.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      </View>
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
        {/* Logo row */}
        <View style={styles.logoRow}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="bar-chart" size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.logoTitle, { color: colors.primary }]}>StockNews</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search company or symbol..."
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

        {/* Exchange filter chips */}
        <View style={styles.filterRow}>
          {EXCHANGE_OPTIONS.map((val) => (
            <TouchableOpacity
              key={val || 'all'}
              onPress={() => setExchange(val)}
              style={[
                styles.filterChip,
                exchange === val
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.surfaceElevated },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  exchange === val
                    ? { color: '#FFFFFF' }
                    : { color: colors.textSecondary },
                ]}
              >
                {val || 'All'}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Stats */}
          {!loading && !error && (
            <Text style={[styles.statsText, { color: colors.textTertiary }]}>
              {companies.length} of {total}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      {loading && companies.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading companies...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.red} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Connection Failed</Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            Ensure the backend is running on port 4000
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={refetch}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
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
              <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No companies found
              </Text>
            </View>
          }
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          getItemLayout={undefined}
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
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '500',
    paddingVertical: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statsText: {
    marginLeft: 'auto',
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.md,
    fontWeight: '500',
    marginTop: Spacing.md,
  },
  errorTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  errorMessage: {
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.lg,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyText: {
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
