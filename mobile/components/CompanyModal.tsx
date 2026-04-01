import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import NewsPanel from './NewsPanel';

interface Company {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  sector?: string;
}

interface CompanyModalProps {
  company: Company | null;
  onClose: () => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (companyId: string) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CompanyModal({
  company,
  onClose,
  isWatchlisted,
  onToggleWatchlist,
}: CompanyModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const heartScale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  if (!company) return null;

  const handleToggleWatchlist = () => {
    heartScale.value = withSpring(1.3, { damping: 6, stiffness: 400 }, () => {
      heartScale.value = withSpring(1, { damping: 8, stiffness: 300 });
    });
    onToggleWatchlist(company.id);
  };

  return (
    <View style={styles.overlay}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(200)}
        exiting={SlideOutDown.duration(250)}
        style={[
          styles.modalContent,
          {
            backgroundColor: colors.surface,
            maxHeight: SCREEN_HEIGHT * 0.85,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandleContainer}>
          <View style={[styles.dragHandle, { backgroundColor: colors.borderLight }]} />
        </View>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.companyName, { color: colors.text }]} numberOfLines={1}>
              {company.name}
            </Text>
            <View style={styles.headerBadges}>
              <Text style={[styles.symbolText, { color: colors.textSecondary }]}>
                {company.symbol}
              </Text>
              <View style={[styles.exchangeBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.exchangeText, { color: colors.primary }]}>
                  {company.exchange}
                </Text>
              </View>
              {company.sector ? (
                <View style={[styles.sectorBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Text style={[styles.sectorText, { color: colors.textSecondary }]}>
                    {company.sector}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleToggleWatchlist}
              style={[
                styles.iconButton,
                {
                  backgroundColor: isWatchlisted ? colors.amberLight : 'transparent',
                },
              ]}
              activeOpacity={0.7}
            >
              <Animated.View style={heartStyle}>
                <Ionicons
                  name={isWatchlisted ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isWatchlisted ? colors.amber : colors.textTertiary}
                />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* News Content */}
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          <NewsPanel companyId={company.id} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  companyName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: 'wrap',
  },
  symbolText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  exchangeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  exchangeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sectorBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sectorText: {
    fontSize: FontSize.xs,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  iconButton: {
    padding: Spacing.sm,
    borderRadius: Radius.full,
  },
  scrollContent: {
    flex: 1,
  },
});
