import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import {
  getMessages,
  markThreadRead,
  openThreadWithPhysio,
  sendMessageHttp,
} from '../../services/chatService';
import { getSocket } from '../../services/socket';
import { useAuthStore } from '../../stores/authStore';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const SW = Dimensions.get('window').width;
const SCALE = SW / 390;
const H_PAD = 24 * SCALE;
const ACCENT = '#e0e7ef';
const INK = '#333333';

const font = (weight: 'Light' | 'Regular' | 'Medium' | 'SemiBold' | 'Bold') =>
  Platform.select({
    ios: `Poppins-${weight}`,
    android: `Poppins-${weight}`,
    default: undefined,
  });

type Msg = {
  _id: string;
  body: string;
  senderId: string;
  senderRole: string;
  createdAt: string;
  pending?: boolean;
};

export default function ChatScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const physiologistId = String((route.params as any)?.physiologistId || '');
  const physioName = (route.params as any)?.physioName || 'Physiotherapist';
  const listRef = useRef<FlatList>(null);

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const user = useAuthStore(s => s.user);
  const myId = String(user?.id || user?._id || '');
  const [error, setError] = useState('');
  const joinedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let sock: any;

    (async () => {
      if (!physiologistId) {
        setError('No physiotherapist selected');
        setLoading(false);
        return;
      }
      try {
        const thread = await openThreadWithPhysio(physiologistId);
        if (!alive) return;
        setThreadId(thread._id);
        joinedThreadRef.current = thread._id;
        const msgs = await getMessages(thread._id);
        if (!alive) return;
        setMessages(msgs);
        markThreadRead(thread._id).catch(() => {});

        sock = await getSocket();
        sock.emit('thread:join', thread._id);
        sock.on('message:new', (payload: any) => {
          if (String(payload?.threadId) !== String(thread._id)) return;
          const m = payload.message;
          if (!m?._id) return;
          setMessages(prev => {
            if (prev.some(x => x._id === m._id)) return prev;
            const withoutPending = prev.filter(
              x => !(x.pending && x.body === m.body && String(x.senderId) === String(m.senderId)),
            );
            return [...withoutPending, m];
          });
          markThreadRead(thread._id).catch(() => {});
        });
      } catch (e: any) {
        if (alive) setError(e?.response?.data?.message || e.message || 'Could not open chat');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (sock && joinedThreadRef.current) sock.emit('thread:leave', joinedThreadRef.current);
      sock?.off?.('message:new');
    };
  }, [physiologistId]);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || !threadId || sending) return;
    setText('');
    setSending(true);
    const tempId = `tmp-${Date.now()}`;
    const optimistic: Msg = {
      _id: tempId,
      body,
      senderId: myId,
      senderRole: 'patient',
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const sock = await getSocket();
      await new Promise<void>((resolve, reject) => {
        sock.emit('message:send', { threadId, body }, (ack: any) => {
          if (ack?.ok && ack.message) {
            setMessages(prev =>
              prev.map(m => (m._id === tempId ? { ...ack.message, pending: false } : m)),
            );
            resolve();
          } else {
            reject(new Error(ack?.message || 'Send failed'));
          }
        });
      });
    } catch {
      try {
        const saved = await sendMessageHttp(threadId, body);
        setMessages(prev =>
          prev.map(m => (m._id === tempId ? { ...saved, pending: false } : m)),
        );
      } catch {
        setMessages(prev => prev.filter(m => m._id !== tempId));
        setText(body);
      }
    } finally {
      setSending(false);
    }
  }, [text, threadId, sending, myId]);

  const renderItem = ({ item }: { item: Msg }) => {
    const mine =
      item.senderRole === 'patient' ||
      (myId && String(item.senderId) === String(myId));
    return (
      <View style={[s.bubbleRow, mine && s.bubbleRowMine]}>
        <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs, item.pending && { opacity: 0.55 }]}>
          <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>{item.body}</Text>
          <Text style={[s.bubbleTime, mine && s.bubbleTimeMine]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Image
            source={require('../../assets/images/figma/profile/icon_back.png')}
            style={s.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>Message</Text>
          <Text style={s.title} numberOfLines={1}>{physioName}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={INK} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m._id}
          renderItem={renderItem}
          contentContainerStyle={[s.list, { paddingBottom: 12 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={s.empty}>Say hello — your physiotherapist will see this in their portal.</Text>
          }
        />
      )}

      <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="Write a message…"
          placeholderTextColor="rgba(51,51,51,0.35)"
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[s.sendBtn, (!text.trim() || !threadId) && s.sendDisabled]}
          onPress={send}
          disabled={!text.trim() || !threadId || sending}
          activeOpacity={0.85}
        >
          <Text style={s.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 * SCALE,
    paddingHorizontal: H_PAD,
    paddingBottom: 12 * SCALE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(51,51,51,0.08)',
  },
  backBtn: {
    width: 40 * SCALE,
    height: 40 * SCALE,
    borderRadius: 20 * SCALE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { width: 18 * SCALE, height: 18 * SCALE },
  eyebrow: {
    fontFamily: font('Medium'),
    fontSize: 10 * SCALE,
    fontWeight: '500',
    color: 'rgba(51,51,51,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: font('Medium'),
    fontSize: 18 * SCALE,
    fontWeight: '500',
    color: INK,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: 'rgba(51,51,51,0.55)',
    textAlign: 'center',
  },
  list: { paddingHorizontal: H_PAD, paddingTop: 16 * SCALE, flexGrow: 1 },
  empty: {
    fontFamily: font('Light'),
    fontSize: 13 * SCALE,
    color: 'rgba(51,51,51,0.45)',
    textAlign: 'center',
    marginTop: 40 * SCALE,
    lineHeight: 20 * SCALE,
  },
  bubbleRow: { marginBottom: 10 * SCALE, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 10 * SCALE,
    backgroundColor: '#f3f5f8',
  },
  bubbleMine: { backgroundColor: ACCENT },
  bubbleTheirs: { backgroundColor: '#f3f5f8' },
  bubbleText: {
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    lineHeight: 20 * SCALE,
    color: INK,
  },
  bubbleTextMine: {
    fontFamily: font('Regular'),
  },
  bubbleTime: {
    fontFamily: font('Light'),
    fontSize: 10 * SCALE,
    color: 'rgba(51,51,51,0.4)',
    marginTop: 4 * SCALE,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(51,51,51,0.45)' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10 * SCALE,
    paddingHorizontal: H_PAD,
    paddingTop: 10 * SCALE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(51,51,51,0.08)',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44 * SCALE,
    maxHeight: 120 * SCALE,
    borderRadius: 16,
    backgroundColor: '#f7f8fb',
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 12 * SCALE,
    fontFamily: font('Light'),
    fontSize: 14 * SCALE,
    color: INK,
  },
  sendBtn: {
    height: 44 * SCALE,
    paddingHorizontal: 16 * SCALE,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  sendText: {
    fontFamily: font('Medium'),
    fontSize: 14 * SCALE,
    fontWeight: '500',
    color: INK,
  },
});
