// A quick look at the selected client while building an invoice: name, email,
// phone, address, tax number. Read-only on purpose; the two buttons hand off to
// the flows that already exist for changing the client and editing their record.
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X as XIcon, Mail, Phone, MapPin, Hash, User } from 'lucide-react-native';

import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import type { Tables } from '@/types/database.types';

type Client = Tables<'clients'>;

export interface ClientDetailsSheetRef {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  client: Client | null;
  onChangeClient: () => void;
  onViewProfile: () => void;
}

const ClientDetailsSheet = forwardRef<ClientDetailsSheetRef, Props>(({ client, onChangeClient, onViewProfile }, ref) => {
  const { isLightMode } = useTheme();
  const theme = isLightMode ? colors.light : colors.dark;
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    [],
  );

  const rows = useMemo(() => {
    if (!client) return [];
    const address = (client.address_client ?? '')
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
    return [
      { icon: Mail, label: 'Email', value: client.email },
      { icon: Phone, label: 'Phone', value: client.phone },
      { icon: MapPin, label: 'Address', value: address || null },
      { icon: Hash, label: 'Tax number', value: client.tax_number },
    ].filter((r) => !!r.value);
  }, [client]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.card }}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.muted }]}>
            <User size={22} color={theme.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.foreground }]} numberOfLines={1}>{client?.name ?? ''}</Text>
            <Text style={[styles.sub, { color: theme.mutedForeground }]}>Client on this invoice</Text>
          </View>
          <TouchableOpacity onPress={() => sheetRef.current?.dismiss()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <XIcon size={22} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {rows.length === 0 ? (
            <Text style={[styles.empty, { color: theme.mutedForeground }]}>No contact details saved for this client yet.</Text>
          ) : (
            rows.map(({ icon: Icon, label, value }, i) => (
              <View key={label} style={[styles.row, i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
                <Icon size={16} color={theme.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.value, { color: theme.foreground }]} selectable>{value}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.muted }]} onPress={onViewProfile} activeOpacity={0.8}>
            <Text style={[styles.buttonText, { color: theme.foreground }]}>Edit details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={onChangeClient} activeOpacity={0.8}>
            <Text style={[styles.buttonText, { color: theme.primaryForeground ?? '#fff' }]}>Change client</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ClientDetailsSheet.displayName = 'ClientDetailsSheet';
export default ClientDetailsSheet;

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 15 },
  empty: { fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
