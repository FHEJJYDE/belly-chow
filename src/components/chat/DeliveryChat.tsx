import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, X, Users, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Participant {
  id: string;
  name: string;
  role: string;
}

interface DeliveryChatProps {
  orderId: string;
  otherName?: string;
  participants?: Participant[];
  defaultOpen?: boolean;
}

const DeliveryChat = ({
  orderId,
  otherName = 'Chat',
  participants = [],
  defaultOpen = false,
}: DeliveryChatProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [senderProfiles, setSenderProfiles] = useState<
    Record<string, { full_name: string; role: string }>
  >({});
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(defaultOpen);
  const knownMessageIds = useRef<Set<string>>(new Set());

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Resolve sender names from profiles if participants array wasn't passed (e.g. VendorOrders)
  const resolveMissingSenders = useCallback(
    async (msgs: Message[]) => {
      const unknownIds = Array.from(
        new Set(
          msgs
            .map((m) => m.sender_id)
            .filter(
              (id) => id !== user?.id && !participantMap.has(id) && !senderProfiles[id]
            )
        )
      );
      if (unknownIds.length === 0) return;

      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, role')
        .in('user_id', unknownIds);

      if (data && data.length > 0) {
        setSenderProfiles((prev) => {
          const next = { ...prev };
          data.forEach((p: any) => {
            next[p.user_id] = {
              full_name: p.full_name || 'User',
              role: p.role || 'student',
            };
          });
          return next;
        });
      }
    },
    [user?.id, participantMap, senderProfiles]
  );

  const getSenderLabel = (senderId: string) => {
    if (senderId === user?.id) return null;
    const p = participantMap.get(senderId);
    if (p) {
      return p.role === 'vendor'
        ? `🍳 ${p.name}`
        : p.role === 'rider'
        ? `🏍️ ${p.name}`
        : `👤 ${p.name}`;
    }
    const resolved = senderProfiles[senderId];
    if (resolved) {
      return resolved.role === 'vendor'
        ? `🍳 ${resolved.full_name}`
        : resolved.role === 'rider'
        ? `🏍️ ${resolved.full_name}`
        : `👤 ${resolved.full_name}`;
    }
    return '👤 Order Participant';
  };

  const fetchMessages = useCallback(async () => {
    if (!orderId || !user) return;
    const { data, error } = await (supabase.from('messages') as any)
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching chat messages:', error);
      return;
    }

    const fetched: Message[] = data || [];
    setMessages((prev) => {
      // Count new incoming unread messages if chat is closed
      if (!wasOpen.current && prev.length > 0) {
        const newFromOthers = fetched.filter(
          (m) => !knownMessageIds.current.has(m.id) && m.sender_id !== user.id
        );
        if (newFromOthers.length > 0) {
          setUnread((u) => u + newFromOthers.length);
        }
      }
      fetched.forEach((m) => knownMessageIds.current.add(m.id));
      return fetched;
    });

    resolveMissingSenders(fetched);
  }, [orderId, user, resolveMissingSenders]);

  useEffect(() => {
    if (!orderId || !user) return;

    fetchMessages();

    // 1. Realtime WebSocket subscription
    const channel = supabase
      .channel(`chat-${orderId}-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload: any) => {
          const msg = payload.new as Message;
          if (!msg?.id) return;
          knownMessageIds.current.add(msg.id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          resolveMissingSenders([msg]);
          if (!wasOpen.current && msg.sender_id !== user.id) {
            setUnread((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
        (payload: any) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    // 2. Fallback polling every 3.5s when open (or 8s when closed) in case Supabase Realtime publication isn't enabled on messages
    const pollInterval = setInterval(
      () => {
        fetchMessages();
      },
      isOpen ? 3500 : 8000
    );

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [orderId, user, isOpen, fetchMessages, resolveMissingSenders]);

  useEffect(() => {
    wasOpen.current = isOpen;
    if (isOpen) {
      setUnread(0);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    }
  }, [isOpen, messages.length]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !user || sending) return;

    setSending(true);
    setInput('');

    // Optimistically insert into local state immediately so the sender always sees their message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      order_id: orderId,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { data: inserted, error } = await (supabase.from('messages') as any)
        .insert({
          order_id: orderId,
          sender_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) {
        // Rollback optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(content);
        toast({
          title: 'Message failed to send',
          description: error.message || 'Check your connection or database permissions.',
          variant: 'destructive',
        });
      } else if (inserted) {
        knownMessageIds.current.add(inserted.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? (inserted as Message) : m))
        );
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(content);
      toast({
        title: 'Message failed to send',
        description: err.message || 'Network error',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    await (supabase.from('messages') as any).delete().eq('id', msgId);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        variant="outline"
        className="gap-2 relative"
      >
        <MessageCircle className="h-4 w-4 text-primary" />
        <span>Chat {messages.length > 0 ? `(${messages.length})` : ''}</span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
            {unread}
          </span>
        )}
      </Button>
    );
  }

  const title =
    participants.length > 0
      ? `Order Chat (${participants.length + 1})`
      : `Chat with ${otherName}`;

  return (
    <div className="mt-3 rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          {participants.length > 0 ? (
            <Users className="h-4 w-4 text-primary" />
          ) : (
            <MessageCircle className="h-4 w-4 text-primary" />
          )}
          {title}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {participants.length > 0 && (
        <div className="flex gap-1.5 px-3.5 py-2 border-b flex-wrap bg-muted/20">
          <Badge variant="secondary" className="text-[10px]">
            You
          </Badge>
          {participants.map((p) => (
            <Badge key={p.id} variant="outline" className="text-[10px]">
              {p.role === 'vendor' ? '🍳' : p.role === 'rider' ? '🏍️' : '👤'} {p.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="p-3">
        <div
          ref={scrollRef}
          className="mb-3 h-56 overflow-y-auto space-y-2.5 rounded-xl border bg-muted/30 p-3"
        >
          {messages.length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">
              No messages yet. Send a message to coordinate delivery! 👋
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const senderLabel = getSenderLabel(msg.sender_id);
            return (
              <div
                key={msg.id}
                className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`relative max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card border text-foreground rounded-bl-sm'
                  }`}
                >
                  {!isMe && senderLabel && (
                    <p className="text-[10px] font-bold mb-0.5 text-primary">
                      {senderLabel}
                    </p>
                  )}
                  <p className="leading-snug break-words">{msg.content}</p>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <p
                      className={`text-[10px] ${
                        isMe ? 'text-primary-foreground/75' : 'text-muted-foreground'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {isMe && !msg.id.startsWith('temp-') && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMessage(msg.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete message"
                      >
                        <Trash2
                          className={`h-3 w-3 ${
                            isMe
                              ? 'text-primary-foreground/70 hover:text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-xl shrink-0"
            disabled={!input.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DeliveryChat;
