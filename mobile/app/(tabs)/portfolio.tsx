import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_ENDPOINTS } from '@/hooks/useApi';

const BROKER_STORAGE_KEY = 'angel_one_credentials';

export default function PortfolioScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [credentials, setCredentials] = useState({
    apiKey: '',
    clientId: '',
    pin: '',
    totpSecret: ''
  });
  
  const [isConfigured, setIsConfigured] = useState(false);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState(0);

  // Load saved credentials
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(BROKER_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCredentials(parsed);
          setIsConfigured(true);
          fetchHoldings(parsed);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    })();
  }, []);

  const fetchHoldings = async (creds: any) => {
    setLoading(true);
    setError(null);
    try {
      const BASE_URL = API_ENDPOINTS.companies.replace('/api/companies', '');
      const res = await fetch(`${BASE_URL}/api/broker/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });
      const data = await res.json();
      
      if (data.success && data.holdings) {
        setHoldings(data.holdings);
        // Calculate abstract total P&L or value
        let total = 0;
        data.holdings.forEach((h: any) => {
          total += (parseFloat(h.ltp) * parseInt(h.quantity));
        });
        setTotalValue(total);
      } else {
        setError(data.error || 'Failed to fetch holdings from broker');
        setIsConfigured(false); // maybe keys were bad
      }
    } catch (err: any) {
      setError(err.message || 'Network error connecting to broker');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndConnect = async () => {
    if (!credentials.apiKey || !credentials.clientId || !credentials.pin || !credentials.totpSecret) {
      setError('Please fill in all fields.');
      return;
    }
    
    setLoading(true);
    try {
      await AsyncStorage.setItem(BROKER_STORAGE_KEY, JSON.stringify(credentials));
      setIsConfigured(true);
      fetchHoldings(credentials);
    } catch (err) {
      setError('Failed to save to secure storage. Please try again.');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await AsyncStorage.removeItem(BROKER_STORAGE_KEY);
    setCredentials({ apiKey: '', clientId: '', pin: '', totpSecret: '' });
    setHoldings([]);
    setIsConfigured(false);
  };

  if (loading && !isConfigured) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // --- LOGIN/CONFIG SCREEN ---
  if (!isConfigured) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Ionicons name="briefcase" size={48} color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>Connect Broker</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Securely view your live Angel One portfolio right here. Your credentials never leave your device.
            </Text>
          </View>

          <View style={styles.form}>
            {error && <Text style={styles.errorText}>{error}</Text>}

            <Text style={[styles.label, { color: colors.text }]}>SmartAPI Key</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. hqxlKNA5"
              placeholderTextColor={colors.textTertiary}
              value={credentials.apiKey}
              onChangeText={(text) => setCredentials({ ...credentials, apiKey: text })}
            />

            <Text style={[styles.label, { color: colors.text }]}>Client ID</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. R273006"
              placeholderTextColor={colors.textTertiary}
              value={credentials.clientId}
              autoCapitalize="characters"
              onChangeText={(text) => setCredentials({ ...credentials, clientId: text })}
            />

            <Text style={[styles.label, { color: colors.text }]}>4-Digit PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Your Login PIN"
              placeholderTextColor={colors.textTertiary}
              value={credentials.pin}
              secureTextEntry
              keyboardType="number-pad"
              onChangeText={(text) => setCredentials({ ...credentials, pin: text })}
            />

            <Text style={[styles.label, { color: colors.text }]}>TOTP Secret Key</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Google Authenticator setup key"
              placeholderTextColor={colors.textTertiary}
              value={credentials.totpSecret}
              autoCapitalize="characters"
              onChangeText={(text) => setCredentials({ ...credentials, totpSecret: text })}
            />

            <Pressable
              style={({ pressed }) => [styles.connectButton, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={handleSaveAndConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>Connect to Angel One</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  // --- PORTFOLIO VIEW SCREEN ---
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Real-time Portfolio</Text>
        <Pressable onPress={handleDisconnect} style={styles.disconnectBtn}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger || '#ef4444'} />
        </Pressable>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Value</Text>
        <Text style={[styles.summaryValue, { color: colors.text }]}>₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          {error && <Text style={[styles.errorText, { marginHorizontal: 20 }]}>{error}</Text>}
          
          {holdings.length === 0 && !error ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No holdings perfectly match your search, or your portfolio is empty.</Text>
          ) : (
            holdings.map((holding: any, index: number) => (
              <View key={index} style={[styles.holdingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.holdingRow}>
                  <Text style={[styles.holdingSymbol, { color: colors.text }]}>{holding.tradingsymbol}</Text>
                  <Text style={[styles.holdingPrice, { color: colors.text }]}>₹{holding.ltp}</Text>
                </View>
                <View style={styles.holdingRow}>
                  <Text style={[styles.holdingQuantity, { color: colors.textSecondary }]}>{holding.quantity} shares</Text>
                  <Text style={[styles.holdingProfit, { color: parseFloat(holding.profitandloss) >= 0 ? '#10b981' : '#ef4444' }]}>
                    {parseFloat(holding.profitandloss) >= 0 ? '+' : ''}₹{holding.profitandloss}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 32, marginTop: 40 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  form: { width: '100%' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginLeft: 4, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  errorText: { color: '#ef4444', marginBottom: 12, textAlign: 'center', fontWeight: '500' },
  connectButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  disconnectBtn: { padding: 4 },
  summaryCard: { margin: 20, marginTop: 0, padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  summaryValue: { fontSize: 32, fontWeight: '800' },
  holdingItem: { padding: 16, marginHorizontal: 20, marginBottom: 12, borderRadius: 12, borderWidth: 1 },
  holdingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  holdingSymbol: { fontSize: 16, fontWeight: '700' },
  holdingQuantity: { fontSize: 13 },
  holdingPrice: { fontSize: 16, fontWeight: '600' },
  holdingProfit: { fontSize: 14, fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
