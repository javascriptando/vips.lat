import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, ArrowLeft, Ban, CheckCircle2, Lock } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Conversation = {
  id: string;
  creatorId?: string;
  userId?: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  isBlocked: boolean;
  // Creator conversation fields
  creatorDisplayName?: string;
  creatorUsername?: string;
  creatorAvatarUrl?: string | null;
  creatorVerified?: boolean;
  // User conversation fields (for creators)
  userName?: string | null;
  userUsername?: string;
  userAvatarUrl?: string | null;
};

function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isCreatorView,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  isCreatorView: boolean;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <MessageCircle size={48} className="text-dark-500 mb-4" />
        <p className="text-gray-400">Nenhuma conversa ainda</p>
        {!isCreatorView && (
          <Link to="/explore" className="text-brand-500 hover:underline mt-2">
            Explorar criadores
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-dark-700">
      {conversations.map((conv) => {
        const name = isCreatorView
          ? conv.userName || conv.userUsername
          : conv.creatorDisplayName;
        const avatar = isCreatorView ? conv.userAvatarUrl : conv.creatorAvatarUrl;
        const isVerified = !isCreatorView && conv.creatorVerified;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={`w-full p-4 flex items-center gap-3 hover:bg-dark-700/50 transition-colors text-left ${
              selectedId === conv.id ? 'bg-dark-700' : ''
            }`}
          >
            <Avatar src={avatar} name={name || ''} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white truncate">{name}</span>
                {isVerified && <CheckCircle2 size={14} className="text-blue-500 fill-blue-500/20" />}
                {conv.isBlocked && <Ban size={14} className="text-red-500" />}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {conv.lastMessagePreview || 'Inicie uma conversa'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{formatRelativeTime(conv.lastMessageAt)}</p>
              {conv.unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 bg-brand-500 text-white text-xs rounded-full mt-1">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChatView({
  conversation,
  onBack,
  isCreatorView,
}: {
  conversation: Conversation;
  onBack: () => void;
  isCreatorView: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const name = isCreatorView
    ? conversation.userName || conversation.userUsername
    : conversation.creatorDisplayName;
  const username = isCreatorView ? conversation.userUsername : conversation.creatorUsername;
  const avatar = isCreatorView ? conversation.userAvatarUrl : conversation.creatorAvatarUrl;

  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => api.getMessages(conversation.id),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const messages = data?.messages || [];

  // Mark as read when opening
  useEffect(() => {
    if (conversation.unreadCount > 0) {
      api.markConversationRead(conversation.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      });
    }
  }, [conversation.id, conversation.unreadCount, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () =>
      isCreatorView
        ? api.sendMessageAsCreator(conversation.id, message)
        : api.sendMessage(conversation.creatorId!, message),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const blockMutation = useMutation({
    mutationFn: () => api.toggleBlockConversation(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creatorConversations'] });
      toast.success(conversation.isBlocked ? 'Conversa desbloqueada' : 'Conversa bloqueada');
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMutation.mutate();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-dark-700 flex items-center gap-3">
        <button onClick={onBack} className="lg:hidden p-2 hover:bg-dark-700 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <Link
          to={isCreatorView ? '#' : `/creator/${username}`}
          className="flex items-center gap-3 flex-1"
        >
          <Avatar src={avatar} name={name || ''} />
          <div>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-sm text-gray-500">@{username}</p>
          </div>
        </Link>
        {isCreatorView && (
          <button
            onClick={() => blockMutation.mutate()}
            disabled={blockMutation.isPending}
            className={`p-2 rounded-lg transition-colors ${
              conversation.isBlocked
                ? 'bg-red-500/10 text-red-500'
                : 'hover:bg-dark-700 text-gray-400'
            }`}
            title={conversation.isBlocked ? 'Desbloquear' : 'Bloquear'}
          >
            <Ban size={20} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
            <p>Nenhuma mensagem ainda</p>
            <p className="text-sm">Envie a primeira mensagem!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    isMe
                      ? 'bg-brand-500 text-white rounded-br-sm'
                      : 'bg-dark-700 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {conversation.isBlocked && !isCreatorView ? (
        <div className="p-4 border-t border-dark-700 text-center">
          <div className="flex items-center justify-center gap-2 text-red-400">
            <Lock size={16} />
            <span className="text-sm">O criador bloqueou esta conversa</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-4 border-t border-dark-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-dark-700 border border-dark-600 rounded-full px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={!message.trim() || sendMutation.isPending}
              className="p-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white transition-colors"
            >
              {sendMutation.isPending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function MessagesView() {
  const { isCreator } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [viewMode, setViewMode] = useState<'user' | 'creator'>(isCreator ? 'creator' : 'user');

  // Fetch conversations based on view mode
  const { data: userConvos, isLoading: loadingUser } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
    enabled: viewMode === 'user',
  });

  const { data: creatorConvos, isLoading: loadingCreator } = useQuery({
    queryKey: ['creatorConversations'],
    queryFn: () => api.getCreatorConversations(),
    enabled: viewMode === 'creator' && isCreator,
  });

  const conversations = viewMode === 'creator' ? creatorConvos?.conversations : userConvos?.conversations;
  const isLoading = viewMode === 'creator' ? loadingCreator : loadingUser;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with tabs for creators */}
      <div className="flex items-center justify-between p-4 border-b border-dark-700">
        <h1 className="text-xl font-bold text-white">Mensagens</h1>
        {isCreator && (
          <div className="flex bg-dark-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('creator')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'creator'
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Como Criador
            </button>
            <button
              onClick={() => setViewMode('user')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'user'
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Como Usuário
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div
          className={`w-full lg:w-80 border-r border-dark-700 overflow-y-auto ${
            selectedConversation ? 'hidden lg:block' : ''
          }`}
        >
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-dark-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 bg-dark-700 rounded" />
                    <div className="h-3 w-32 bg-dark-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ConversationList
              conversations={conversations || []}
              selectedId={selectedConversation?.id || null}
              onSelect={setSelectedConversation}
              isCreatorView={viewMode === 'creator'}
            />
          )}
        </div>

        {/* Chat View */}
        <div
          className={`flex-1 ${
            selectedConversation ? '' : 'hidden lg:flex'
          } flex-col`}
        >
          {selectedConversation ? (
            <ChatView
              conversation={selectedConversation}
              onBack={() => setSelectedConversation(null)}
              isCreatorView={viewMode === 'creator'}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageCircle size={64} className="mx-auto text-dark-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Suas Mensagens</h2>
                <p className="text-gray-500">
                  Selecione uma conversa para ver as mensagens
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
