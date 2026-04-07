import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withSequence,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

interface StockCardProps {
  company: Company;
  onPress: (company: Company) => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (companyId: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function StockCard({
  company,
  onPress,
  isWatchlisted,
  onToggleWatchlist,
}: StockCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const heartScale = useSharedValue(1);
  const cardScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handleHeartPress = () => {
    heartScale.value = withSequence(
      withSpring(1.2, { damping: 10, stiffness: 500 }),
      withSpring(1.1, { damping: 15, stiffness: 600 }),
      withSpring(1, { damping: 15, stiffness: 600 })
    );
    onToggleWatchlist(company.id);
  };

  const handleCardPressIn = () => {
    cardScale.value = withSpring(0.98, { damping: 20, stiffness: 500 });
  };

  const handleCardPressOut = () => {
    cardScale.value = withSpring(1, { damping: 20, stiffness: 500 });
  };

  return (
    <AnimatedPressable
      onPress={() => onPress(company)}
      onPressIn={handleCardPressIn}
      onPressOut={handleCardPressOut}
      style={[
        cardStyle,
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isWatchlisted ? colors.amber : colors.border,
          borderWidth: isWatchlisted ? 1.5 : 1,
          shadowColor: colors.cardShadow,
        },
      ]}
    >
      {/* Heart button */}
      <TouchableOpacity
        onPress={handleHeartPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.heartButton}
        activeOpacity={0.7}
      >
        <Animated.View style={heartStyle}>
          <Ionicons
            name={isWatchlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWatchlisted ? colors.amber : colors.textTertiary}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Company info */}
      <View style={styles.companyInfo}>
        <Text
          style={[styles.companyName, { color: colors.text }]}
          numberOfLines={1}
        >
          {company.name}
        </Text>
        <Text
          style={[styles.companySymbol, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {company.symbol}
        </Text>
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { borderTopColor: colors.borderLight }]}>
        <View style={styles.badges}>
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              {company.exchange}
            </Text>
          </View>
          {company.sector ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.surfaceElevated },
              ]}
            >
              <Text
                style={[styles.badgeText, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {company.sector}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.newsHint}>
          <Ionicons name="newspaper-outline" size={12} color={colors.textTertiary} />
          <Text style={[styles.newsHintText, { color: colors.textTertiary }]}>
            News
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'space-between',
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
    padding: 4,
  },
  companyInfo: {
    paddingRight: 32,
    marginBottom: Spacing.md,
  },
  companyName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  companySymbol: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: 2,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    overflow: 'hidden',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  newsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: Spacing.sm,
  },
  newsHintText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
});

export default memo(StockCard);
