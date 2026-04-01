import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompanyNews, NewsArticle } from '@/hooks/useApi';

interface NewsPanelProps {
  companyId: string;
}

function NewsItem({ article, colors }: { article: NewsArticle; colors: typeof Colors.light }) {
  const publishDate = new Date(article.publishedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[styles.newsItem, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}
      activeOpacity={0.7}
      onPress={() => WebBrowser.openBrowserAsync(article.url)}
    >
      <View style={styles.newsHeader}>
        <View style={[styles.sourceBadge, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.sourceText, { color: colors.accent }]}>
            {article.source}
          </Text>
        </View>
        <Text style={[styles.dateText, { color: colors.textTertiary }]}>
          {publishDate}
        </Text>
      </View>
      <Text style={[styles.newsTitle, { color: colors.text }]} numberOfLines={3}>
        {article.title}
      </Text>
      <View style={styles.readMore}>
        <Ionicons name="open-outline" size={11} color={colors.textTertiary} />
        <Text style={[styles.readMoreText, { color: colors.textTertiary }]}>
          Read full article
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function NewsPanel({ companyId }: NewsPanelProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { news, loading, error } = useCompanyNews(companyId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.panelTitle, { color: colors.text }]}>Latest News</Text>
        </View>
        <Text style={[styles.headerHint, { color: colors.textTertiary }]}>No duplicates</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={32} color={colors.red} />
          <Text style={[styles.errorText, { color: colors.red }]}>
            Failed to load news
          </Text>
          <Text style={[styles.errorHint, { color: colors.textSecondary }]}>
            Is the backend running?
          </Text>
        </View>
      ) : news.length > 0 ? (
        <View style={styles.newsList}>
          {news.map((article) => (
            <NewsItem key={article.id} article={article} colors={colors} />
          ))}
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="newspaper-outline" size={32} color={colors.textTertiary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No recent news articles found
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  panelTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  headerHint: {
    fontSize: FontSize.xs,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  errorHint: {
    fontSize: FontSize.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  newsList: {
    gap: Spacing.md,
  },
  newsItem: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sourceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
  },
  sourceText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  dateText: {
    fontSize: FontSize.xs,
    flexShrink: 0,
  },
  newsTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  readMoreText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});
