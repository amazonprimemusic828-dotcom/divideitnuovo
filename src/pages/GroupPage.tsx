import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Send, Users, Calendar, DollarSign, Copy, Share2, 
  Settings, MoreVertical, Check, Clock, Shield, Bell, Link, 
  Crown, UserPlus, Info, Phone, Mail, MoreHorizontal, Trash2
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

const serviceConfigs = {
  'apple-music': { icon: '🎵', label: 'Apple Music', gradient: 'from-pink-500 to-rose-500', color: '#fc3c44' },
  'netflix': { icon: 'N', label: 'Netflix', gradient: 'from-red-600 to-red-700', color: '#e50914' },
  'disney': { icon: 'D+', label: 'Disney+', gradient: 'from-blue-600 to-indigo-900', color: '#113ccf' },
  'spotify': { icon: '🎧', label: 'Spotify', gradient: 'from-green-500 to-green-600', color: '#1ed760' },
};

const avatarColors = [
  'bg-gradient-to-br from-pink-500 to-rose-500',
  'bg-gradient-to-br from-blue-500 to-indigo-500',
  'bg-gradient-to-br from-green-500 to-emerald-500',
  'bg-gradient-to-br from-purple-500 to-violet-500',
  'bg-gradient-to-br from-orange-500 to-amber-500',
  'bg-gradient-to-br from-cyan-500 to-teal-500',
];

// Mock data - in real app this would come from API/database
const groupsData: Record<string, {
  serviceName: string;
  serviceType: 'apple-music' | 'netflix' | 'disney' | 'spotify';
  admin: string;
  pricePerPerson: string;
  totalPrice: string;
  members: string;
  billingDay: number;
  inviteCode: string;
}> = {
  'apple-music-famiglia': {
    serviceName: "Apple Music Famiglia",
    serviceType: "apple-music",
    admin: "Cal",
    pricePerPerson: "€2.83",
    totalPrice: "€16.99",
    members: "6/6",
    billingDay: 1,
    inviteCode: "APM-X8K2-M9PL"
  },
  'netflix-base': {
    serviceName: "Netflix Base con Pubblicità",
    serviceType: "netflix",
    admin: "Cal",
    pricePerPerson: "€5.49",
    totalPrice: "€5.49",
    members: "1/1",
    billingDay: 1,
    inviteCode: "NFL-Y3R7-T2QS"
  },
  'disney-premium': {
    serviceName: "Disney+ Premium",
    serviceType: "disney",
    admin: "Ana",
    pricePerPerson: "€3.00",
    totalPrice: "€12.00",
    members: "2/4",
    billingDay: 1,
    inviteCode: "DSN-P4L9-K7RT"
  }
};

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
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
    {
      id: '4',
      senderId: 'user2',
      senderName: 'Marco',
      senderAvatar: 'M',
      content: 'Qualcuno sa quando scade il prossimo pagamento?',
      timestamp: new Date(Date.now() - 900000),
      isOwn: false,
    },
    {
      id: '5',
      senderId: 'user1',
      senderName: 'Cal',
      senderAvatar: 'C',
      content: 'Il prossimo addebito è il giorno 1 del mese! Vi mando un promemoria qualche giorno prima 👍',
      timestamp: new Date(Date.now() - 300000),
      isOwn: true,
    },
  ]);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const group = groupsData[groupId || ''] || groupsData['apple-music-famiglia'];
  const serviceConfig = serviceConfigs[group.serviceType];

  const members: Member[] = [
    { id: '1', name: 'Cal', email: 'calcium9282@gmail.com', avatar: 'C', role: 'admin', paid: true, joinedAt: '1 ott 2024' },
    { id: '2', name: 'Marco Rossi', email: 'marco.r@gmail.com', avatar: 'M', role: 'member', paid: true, joinedAt: '5 ott 2024' },
    { id: '3', name: 'Sara Bianchi', email: 'sara.b@gmail.com', avatar: 'S', role: 'member', paid: true, joinedAt: '8 ott 2024' },
    { id: '4', name: 'Luca Verdi', email: 'luca.v@gmail.com', avatar: 'L', role: 'member', paid: false, joinedAt: '12 ott 2024' },
    { id: '5', name: 'Giulia Neri', email: 'giulia.n@gmail.com', avatar: 'G', role: 'member', paid: true, joinedAt: '15 ott 2024' },
    { id: '6', name: 'Andrea Blu', email: 'andrea.b@gmail.com', avatar: 'A', role: 'member', paid: true, joinedAt: '18 ott 2024' },
  ];

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${serviceConfig.gradient} flex items-center justify-center text-white font-bold shadow-lg`}>
              <span>{serviceConfig.icon}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg text-foreground truncate">{group.serviceName}</h1>
              <p className="text-sm text-muted-foreground">{members.length} membri • {members.filter(m => m.paid).length} pagati</p>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2.5 hover:bg-secondary rounded-xl transition-colors">
                <Phone className="w-5 h-5 text-muted-foreground" />
              </button>
              <button className="p-2.5 hover:bg-secondary rounded-xl transition-colors">
                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto flex h-[calc(100vh-73px)]">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex w-80 border-r border-border flex-col bg-secondary/20">
          {/* Quick Stats */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs text-muted-foreground mb-1 font-medium">La Tua Quota</p>
                <p className="text-2xl font-bold text-primary">{group.pricePerPerson}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">/mese</p>
              </div>
              <div className="bg-card rounded-xl p-4 text-center shadow-sm">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Membri</p>
                <p className="text-2xl font-bold text-accent">{group.members}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">attivi</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {(['members', 'info'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
                  activeTab === tab ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'members' && 'Membri'}
                {tab === 'info' && 'Info'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'members' && (
              <div className="p-4 space-y-2">
                {members.map((member, index) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-card rounded-xl hover:shadow-md transition-all group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${avatarColors[index % avatarColors.length]}`}>
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate text-sm">{member.name}</p>
                        {member.role === 'admin' && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    {member.paid ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                        <Check className="w-3 h-3 inline mr-0.5" />
                        Pagato
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                        In attesa
                      </span>
                    )}
                  </div>
                ))}
                
                <button className="w-full mt-4 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2 group">
                  <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-sm">Invita Membro</span>
                </button>
              </div>
            )}

            {activeTab === 'info' && (
              <div className="p-4 space-y-4">


                {/* Details */}
                <div className="bg-card rounded-xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium">Prezzo Totale</span>
                    </div>
                    <span className="font-bold text-foreground">{group.totalPrice}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-accent" />
                      </div>
                      <span className="text-sm font-medium">Fatturazione</span>
                    </div>
                    <span className="font-bold text-foreground">Giorno {group.billingDay}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-amber-500" />
                      </div>
                      <span className="text-sm font-medium">Admin</span>
                    </div>
                    <span className="font-bold text-foreground">{group.admin}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <button className="w-full bg-card hover:bg-secondary p-3.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm shadow-sm">
                    <Share2 className="w-4 h-4" />
                    Condividi Gruppo
                  </button>
                  <button className="w-full bg-card hover:bg-secondary p-3.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm shadow-sm">
                    <Bell className="w-4 h-4" />
                    Notifiche
                  </button>
                  <button className="w-full bg-card hover:bg-secondary p-3.5 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm shadow-sm">
                    <Settings className="w-4 h-4" />
                    Impostazioni Gruppo
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-secondary/30 to-card">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
            {messages.map((msg, index) => {
              const showDate = index === 0 || 
                formatDate(msg.timestamp) !== formatDate(messages[index - 1].timestamp);
              
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-6">
                      <span className="px-4 py-1.5 bg-card rounded-full text-xs text-muted-foreground font-medium shadow-sm">
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex items-end gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
                    {!msg.isOwn && (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColors[parseInt(msg.senderId.slice(-1)) % avatarColors.length]}`}>
                        {msg.senderAvatar}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                      {!msg.isOwn && (
                        <p className="text-xs text-muted-foreground mb-1.5 ml-1 font-medium">{msg.senderName}</p>
                      )}
                      <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                        msg.isOwn 
                          ? 'bg-accent text-accent-foreground rounded-br-md' 
                          : 'bg-card text-card-foreground rounded-bl-md'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      </div>
                      <p className={`text-[10px] mt-1.5 px-1 ${msg.isOwn ? 'text-right' : 'text-left'} text-muted-foreground`}>
                        {formatTime(msg.timestamp)}
                        {msg.isOwn && <Check className="w-3 h-3 inline ml-1" />}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 md:p-6 bg-card border-t border-border">
            <div className="flex items-center gap-3 max-w-4xl mx-auto">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Scrivi un messaggio..."
                className="flex-1 px-5 py-3.5 bg-secondary rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-accent text-sm transition-all"
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim()}
                className="p-3.5 bg-accent text-accent-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-lg shadow-accent/25 hover:shadow-xl hover:shadow-accent/30"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-2 flex gap-2">
          {(['chat', 'members', 'info'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                activeTab === tab 
                  ? 'bg-accent text-accent-foreground' 
                  : 'text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab === 'chat' && 'Chat'}
              {tab === 'members' && 'Membri'}
              {tab === 'info' && 'Info'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
