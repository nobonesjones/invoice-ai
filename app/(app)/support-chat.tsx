// Chat with the founder. A plain message thread: the user types, it lands on
// Harry's phone over Telegram, his reply comes back here live. No ticket
// numbers, no forms, no "we'll get back to you".
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Send, AlertCircle } from "lucide-react-native";

import { useTheme } from "@/context/theme-provider";
import { useTabBarVisibility } from "@/context/TabBarVisibilityContext";
import { useSupportChat, type SupportMessage } from "@/hooks/useSupportChat";

export const SUPPORT_OWNER_NAME = "Harry";

const WELCOME =
  `Hi, I'm ${SUPPORT_OWNER_NAME}, I built SuperInvoice. ` +
  "Ask me anything: a question, a bug, something you wish the app did. I read every message myself and reply here.";

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

export default function SupportChatScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { messages, loading, error, send, retry, ready } = useSupportChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<SupportMessage>>(null);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false);
    }, [setIsTabBarVisible]),
  );

  useEffect(() => {
    if (messages.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const onSend = () => {
    const text = draft.trim();
    if (!text || !ready) return;
    setDraft("");
    send(text);
  };

  const renderItem = ({ item }: { item: SupportMessage }) => {
    const mine = item.sender === "user";
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        <View
          style={[
            styles.bubble,
            mine
              ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: theme.card, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
            item.pending && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.body, { color: mine ? theme.primaryForeground ?? "#fff" : theme.foreground }]}>{item.body}</Text>
        </View>
        {item.failed ? (
          <TouchableOpacity onPress={() => retry(item.id)} style={styles.failed}>
            <AlertCircle size={13} color="#DC2626" />
            <Text style={styles.failedText}>Not sent. Tap to retry</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.time, { color: theme.mutedForeground }]}>{timeLabel(item.created_at)}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ChevronLeft size={26} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.foreground }]}>{SUPPORT_OWNER_NAME}</Text>
          <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>Founder of SuperInvoice · replies personally</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.mutedForeground} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.errorText, { color: theme.mutedForeground }]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={[styles.row, styles.rowTheirs]}>
                <View style={[styles.bubble, { backgroundColor: theme.card, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
                  <Text style={[styles.body, { color: theme.foreground }]}>{WELCOME}</Text>
                </View>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <TextInput
            style={[styles.input, { color: theme.foreground, backgroundColor: theme.card, borderColor: theme.border }]}
            placeholder={`Message ${SUPPORT_OWNER_NAME}…`}
            placeholderTextColor={theme.mutedForeground}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            editable={ready}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={!draft.trim() || !ready}
            style={[styles.sendBtn, { backgroundColor: draft.trim() && ready ? theme.primary : theme.muted }]}
            accessibilityLabel="Send"
          >
            <Send size={18} color={draft.trim() && ready ? theme.primaryForeground ?? "#fff" : theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 14, textAlign: "center" },
  list: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  row: { maxWidth: "82%" },
  rowMine: { alignSelf: "flex-end", alignItems: "flex-end" },
  rowTheirs: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  body: { fontSize: 15.5, lineHeight: 21 },
  time: { fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  failed: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  failedText: { fontSize: 11, color: "#DC2626" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 15.5 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
