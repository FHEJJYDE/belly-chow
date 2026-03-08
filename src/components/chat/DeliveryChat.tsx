import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Send, X } from 'lucide-react';

interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface DeliveryChatProps {
  orderId: string;
  otherName?: string;
}

const DeliveryChat = ({ orderId, otherName = 'Chat' }: DeliveryChatProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!orderId || !user) return;

    const fetchMessages = async () => {
      const { data } = await (supabase.from('messages') as any)
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };
    fetchMessages();

    const channel = supabase.channel(`chat-${orderId}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `order_id=eq.${orderId}` },
      (payload: any) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev, msg]);
        if (!wasOpen.current && msg.sender_id !== user.id) {
          setUnread(prev => prev + 1);
        }
      }
    ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, user]);

  useEffect(() => {
    wasOpen.current = isOpen;
    if (isOpen) {
      setUnread(0);
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    await (supabase.from('messages') as any).insert({
      order_id: orderId,
      sender_id: user.id,
      content: input.trim(),
    });
    setInput('');
    setSending(false);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        variant="outline"
        className="gap-2 relative"
      >
        <MessageCircle className="h-4 w-4" />
        Chat
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </Button>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4 text-primary" />
          Chat with {otherName}
        </CardTitle>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div ref={scrollRef} className="mb-3 h-48 overflow-y-auto space-y-2 rounded-lg border bg-muted/30 p-2">
          {messages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">No messages yet. Say hi! 👋</p>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-0.5 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DeliveryChat;
