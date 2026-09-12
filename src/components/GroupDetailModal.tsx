import { useState, useRef, useEffect } from "react";
import { 
  X, Send, Users, Calendar, DollarSign, Copy, Share2, 
  Settings, MoreVertical, ChevronLeft, Check, Clock, 
  Shield, Bell, Link, Crown, UserPlus, Info
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'member';
  paid: boolean;
  joinedAt: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  isOwn: boolean;
}

interface GroupDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: {
    serviceName: string;
    serviceType: 'apple-music' | 'netflix' | 'disney' | 'spotify';
    admin: string;
    pricePerPerson: string;
    totalPrice: string;
    members: string;
    billingDay: number;
    inviteCode: string;
  };
}

const serviceConfigs = {
  'apple-music': { icon: '🎵', label: 'Apple Music', gradient: 'from-pink-500 to-rose-500' },
  'netflix': { icon: 'N', label: 'Netflix', gradient: 'from-red-600 to-red-700' },
  'disney': { icon: 'D+', label: 'Disney+', gradient: 'from-blue-600 to-indigo-900' },
  'spotify': { icon: '🎧', label: 'Spotify', gradient: 'from-green-500 to-green-600' },
};

const avatarColors = [
  'bg-gradient-to-br from-pink-500 to-rose-500',
  'bg-gradient-to-br from-blue-500 to-indigo-500',
  'bg-gradient-to-br from-green-500 to-emerald-500',
  'bg-gradient-to-br from-purple-500 to-violet-500',
  'bg-gradient-to-br from-orange-500 to-amber-500',
  'bg-gradient-to-br from-cyan-500 to-teal-500',
];

export function GroupDetailModal({ isOpen, onClose, group }: GroupDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'info'>('chat');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: 'user1',
      senderName: 'Cal',
      senderAvatar: 'C',
      content: 'Ciao a tutti! Benvenuti nel gruppo 🎉',
      timestamp: new Date(Date.now() - 86400000),
      isOwn: true,
    },
    {
      id: '2',
      senderId: 'user2',
      senderName: 'Marco',
      senderAvatar: 'M',
      content: 'Grazie per l\'invito! Ho appena completato il pagamento.',
      timestamp: new Date(Date.now() - 3600000),
      isOwn: false,
    },
    {
      id: '3',
      senderId: 'user3',
      senderName: 'Sara',
      senderAvatar: 'S',
      content: 'Perfetto, tutto funziona! 🎵',
      timestamp: new Date(Date.now() - 1800000),
      isOwn: false,
    },
  ]);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const members: Member[] = [
    { id: '1', name: 'Cal', email: 'calcium9282@gmail.com', avatar: 'C', role: 'admin', paid: true, joinedAt: '1 ott 2024' },
    { id: '2', name: 'Marco Rossi', email: 'marco.r@gmail.com', avatar: 'M', role: 'member', paid: true, joinedAt: '5 ott 2024' },
    { id: '3', name: 'Sara Bianchi', email: 'sara.b@gmail.com', avatar: 'S', role: 'member', paid: true, joinedAt: '8 ott 2024' },
    { id: '4', name: 'Luca Verdi', email: 'luca.v@gmail.com', avatar: 'L', role: 'member', paid: false, joinedAt: '12 ott 2024' },
  ];

  const serviceConfig = serviceConfigs[group.serviceType];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'currentUser',
      senderName: 'Cal',
      senderAvatar: 'C',
      content: message,
      timestamp: new Date(),
      isOwn: true,
    };
    
    setMessages([...messages, newMessage]);
    setMessage('');
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Oggi';
    if (date.toDateString() === yesterday.toDateString()) return 'Ieri';
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="modal-overlay" onClick={onClose} />
      
      {/* Modal */}
      <div className="modal-content flex flex-col md:flex-row">
        {/* Left Panel - Group Info & Tabs */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border flex flex-col bg-secondary/30">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-lg transition-colors md:hidden"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={`service-icon w-12 h-12 bg-gradient-to-br ${serviceConfig.gradient}`}>
                <span className="text-lg">{serviceConfig.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-foreground truncate">{group.serviceName}</h2>
                <p className="text-sm text-muted-foreground">{serviceConfig.label}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-lg transition-colors hidden md:block"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">La Tua Quota</p>
              <p className="text-lg font-bold text-primary">{group.pricePerPerson}</p>
              <p className="text-[10px] text-muted-foreground">/mese</p>
            </div>
            <div className="bg-card rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Membri</p>
              <p className="text-lg font-bold text-accent">{group.members}</p>
              <p className="text-[10px] text-muted-foreground">attivi</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['chat', 'members', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-item flex-1 ${activeTab === tab ? 'tab-item-active' : ''}`}
              >
                {tab === 'chat' && 'Chat'}
                {tab === 'members' && 'Membri'}
                {tab === 'info' && 'Info'}
              </button>
            ))}
          </div>

          {/* Tab Content - Members */}
          {activeTab === 'members' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl hover:shadow-md transition-all"
                >
                  <div className={`member-avatar ${avatarColors[index % avatarColors.length]}`}>
                    {member.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{member.name}</p>
                      {member.role === 'admin' && (
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  {member.paid ? (
                    <span className="badge-paid text-[10px]">
                      <Check className="w-3 h-3 inline mr-0.5" />
                      Pagato
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-[10px] bg-amber-100 text-amber-700 font-medium">
                      In attesa
                    </span>
                  )}
                </div>
              ))}
              
              <button className="w-full mt-4 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span className="font-medium">Invita Membro</span>
              </button>
            </div>
          )}

          {/* Tab Content - Info */}
          {activeTab === 'info' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">


              {/* Details */}
              <div className="bg-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Prezzo Totale</span>
                  </div>
                  <span className="font-semibold text-foreground">{group.totalPrice}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Fatturazione</span>
                  </div>
                  <span className="font-semibold text-foreground">Giorno {group.billingDay}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Admin</span>
                  </div>
                  <span className="font-semibold text-foreground">{group.admin}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button className="w-full btn-secondary flex items-center justify-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Condividi Gruppo
                </button>
                <button className="w-full btn-secondary flex items-center justify-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifiche
                </button>
                <button className="w-full btn-secondary flex items-center justify-center gap-2">
                  <Settings className="w-4 h-4" />
                  Impostazioni
                </button>
              </div>
            </div>
          )}

          {/* Empty space for chat tab - content is on right panel */}
          {activeTab === 'chat' && (
            <div className="hidden md:block flex-1" />
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className={`flex-1 flex flex-col ${activeTab !== 'chat' && 'hidden md:flex'}`}>
          {/* Chat Header */}
          <div className="chat-header">
            <div className={`service-icon w-10 h-10 bg-gradient-to-br ${serviceConfig.gradient}`}>
              <span>{serviceConfig.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Chat del Gruppo</h3>
              <p className="text-xs text-muted-foreground">{members.length} membri • {members.filter(m => m.paid).length} pagati</p>
            </div>
            <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages custom-scrollbar">
            {messages.map((msg, index) => {
              const showDate = index === 0 || 
                formatDate(msg.timestamp) !== formatDate(messages[index - 1].timestamp);
              
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-4">
                      <span className="px-3 py-1 bg-secondary rounded-full text-xs text-muted-foreground">
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                    {!msg.isOwn && (
                      <div className={`member-avatar w-8 h-8 text-xs ${avatarColors[parseInt(msg.senderId.slice(-1)) % avatarColors.length]}`}>
                        {msg.senderAvatar}
                      </div>
                    )}
                    <div>
                      {!msg.isOwn && (
                        <p className="text-xs text-muted-foreground mb-1 ml-1">{msg.senderName}</p>
                      )}
                      <div className={`chat-message ${msg.isOwn ? 'chat-message-sent' : 'chat-message-received'}`}>
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${msg.isOwn ? 'text-accent-foreground/60' : 'text-muted-foreground'}`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="chat-input-container">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Scrivi un messaggio..."
                className="chat-input flex-1"
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="p-3 bg-accent text-accent-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
