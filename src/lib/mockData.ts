// ============================================
// 📦 MOCK DATA - Database fake localStorage
// ============================================

// ============================================
// 👤 UTENTE CORRENTE (simulato loggato)
// ============================================
export const MOCK_USER = {
  id: "user-1",
  email: "mario.rossi@gmail.com",
  full_name: "Mario Rossi",
  avatar_url: null,
  role: "user",
  phone: "+39 333 123 4567",
  birth_date: "1990-05-15",
  withdrawal_first_name: "Mario",
  withdrawal_last_name: "Rossi",
  withdrawal_iban: "IT60X0542811101000000123456",
  created_date: "2025-11-01T10:00:00Z"
};

// ============================================
// 📺 GRUPPI (8 gruppi di esempio)
// ============================================
export const MOCK_GROUPS = [
  {
    id: "group-1",
    service_name: "Netflix Premium",
    service_type: "Netflix",
    plan_type: "Premium 4K",
    total_cost: 17.99,
    currency: "EUR",
    max_members: 4,
    billing_date: 15,
    description: "Gruppo Netflix famiglia - pagamento puntuale richiesto!",
    invite_code: "NETFL1",
    status: "active",
    is_public: true,
    admin_email: "admin@test.it",
    created_date: "2025-12-01T10:00:00Z"
  },
  {
    id: "group-2",
    service_name: "Spotify Family",
    service_type: "Spotify",
    plan_type: "Family Plan",
    total_cost: 15.99,
    currency: "EUR",
    max_members: 6,
    billing_date: 1,
    description: "Spotify per tutta la famiglia!",
    invite_code: "SPOT22",
    status: "active",
    is_public: true,
    admin_email: "mario.rossi@gmail.com",
    created_date: "2025-12-05T14:30:00Z"
  },
  {
    id: "group-3",
    service_name: "Disney+ Standard",
    service_type: "Disney+",
    plan_type: "Standard",
    total_cost: 8.99,
    currency: "EUR",
    max_members: 4,
    billing_date: 10,
    description: "Marvel, Star Wars, Pixar",
    invite_code: "DISN33",
    status: "active",
    is_public: true,
    admin_email: "user2@test.it",
    created_date: "2025-12-10T09:00:00Z"
  },
  {
    id: "group-4",
    service_name: "Amazon Prime Video",
    service_type: "Amazon Prime",
    plan_type: "Annual",
    total_cost: 49.90,
    currency: "EUR",
    max_members: 3,
    billing_date: 20,
    description: "Prime Video + spedizioni gratis",
    invite_code: "AMZN44",
    status: "full",
    is_public: true,
    admin_email: "user3@test.it",
    created_date: "2025-11-15T11:20:00Z"
  },
  {
    id: "group-5",
    service_name: "YouTube Premium Family",
    service_type: "YouTube Premium",
    plan_type: "Family",
    total_cost: 17.99,
    currency: "EUR",
    max_members: 5,
    billing_date: 5,
    description: "YouTube senza ads + Music",
    invite_code: "YOUT55",
    status: "active",
    is_public: true,
    admin_email: "user4@test.it",
    created_date: "2025-12-12T16:45:00Z"
  },
  {
    id: "group-6",
    service_name: "PlayStation Plus Extra",
    service_type: "PlayStation Plus",
    plan_type: "Extra",
    total_cost: 13.99,
    currency: "EUR",
    max_members: 2,
    billing_date: 25,
    description: "Giochi PS4/PS5 + online",
    invite_code: "PS666",
    status: "active",
    is_public: true,
    admin_email: "gamer@test.it",
    created_date: "2026-01-05T12:00:00Z"
  },
  {
    id: "group-7",
    service_name: "Xbox Game Pass Ultimate",
    service_type: "Xbox Game Pass",
    plan_type: "Ultimate",
    total_cost: 14.99,
    currency: "EUR",
    max_members: 3,
    billing_date: 8,
    description: "Centinaia di giochi + Live Gold",
    invite_code: "XBOX77",
    status: "active",
    is_public: true,
    admin_email: "user5@test.it",
    created_date: "2026-01-08T10:30:00Z"
  },
  {
    id: "group-8",
    service_name: "Microsoft 365 Family",
    service_type: "Microsoft 365",
    plan_type: "Family",
    total_cost: 9.99,
    currency: "EUR",
    max_members: 6,
    billing_date: 12,
    description: "Office + 1TB OneDrive",
    invite_code: "MS36588",
    status: "active",
    is_public: true,
    admin_email: "user6@test.it",
    created_date: "2025-11-20T14:00:00Z"
  }
];

// ============================================
// 👥 MEMBRI
// ============================================
export const MOCK_MEMBERSHIPS = [
  {
    id: "memb-1",
    group_id: "group-2",
    user_email: "mario.rossi@gmail.com",
    user_name: "Mario Rossi",
    user_avatar_url: null,
    role: "admin",
    payment_status: "paid",
    joined_date: "2025-12-05",
    created_date: "2025-12-05T14:30:00Z"
  },
  {
    id: "memb-2",
    group_id: "group-1",
    user_email: "mario.rossi@gmail.com",
    user_name: "Mario Rossi",
    user_avatar_url: null,
    role: "member",
    payment_status: "paid",
    joined_date: "2025-12-15",
    created_date: "2025-12-15T09:00:00Z"
  },
  {
    id: "memb-3",
    group_id: "group-1",
    user_email: "admin@test.it",
    user_name: "Admin Netflix",
    user_avatar_url: null,
    role: "admin",
    payment_status: "paid",
    joined_date: "2025-12-01",
    created_date: "2025-12-01T10:00:00Z"
  },
  {
    id: "memb-4",
    group_id: "group-1",
    user_email: "user7@test.it",
    user_name: "Luca Verdi",
    user_avatar_url: null,
    role: "member",
    payment_status: "paid",
    joined_date: "2025-12-10",
    created_date: "2025-12-10T11:00:00Z"
  },
  {
    id: "memb-5",
    group_id: "group-2",
    user_email: "user8@test.it",
    user_name: "Anna Bianchi",
    user_avatar_url: null,
    role: "member",
    payment_status: "pending",
    joined_date: "2026-01-15",
    created_date: "2026-01-15T16:30:00Z"
  }
];

// ============================================
// 💬 MESSAGGI CHAT
// ============================================
export const MOCK_MESSAGES = [
  {
    id: "msg-1",
    group_id: "group-2",
    sender_email: "mario.rossi@gmail.com",
    sender_name: "Mario Rossi",
    message: "Ciao a tutti! Benvenuti nel gruppo Spotify 🎵",
    created_date: "2025-12-05T15:00:00Z"
  },
  {
    id: "msg-2",
    group_id: "group-2",
    sender_email: "user8@test.it",
    sender_name: "Anna Bianchi",
    message: "Grazie! Felice di esserci!",
    created_date: "2025-12-05T15:15:00Z"
  },
  {
    id: "msg-3",
    group_id: "group-2",
    sender_email: "mario.rossi@gmail.com",
    sender_name: "Mario Rossi",
    message: "Ricordatevi di pagare entro il giorno 1 💰",
    created_date: "2026-01-10T10:00:00Z"
  },
  {
    id: "msg-4",
    group_id: "group-1",
    sender_email: "admin@test.it",
    sender_name: "Admin Netflix",
    message: "Prossimo pagamento il 15 gennaio",
    created_date: "2026-01-08T12:00:00Z"
  }
];

// ============================================
// 🔔 NOTIFICHE
// ============================================
export const MOCK_NOTIFICATIONS = [
  {
    id: "notif-1",
    user_email: "mario.rossi@gmail.com",
    type: "member_joined",
    title: "Nuovo membro!",
    content: "Anna Bianchi si è unita a Spotify Family",
    link: "/GroupDetail?id=group-2",
    read: false,
    group_id: "group-2",
    created_date: "2026-01-15T16:30:00Z"
  },
  {
    id: "notif-2",
    user_email: "mario.rossi@gmail.com",
    type: "payment",
    title: "Pagamento completato",
    content: "Hai pagato €4.50 per Netflix",
    link: "/Wallet",
    read: true,
    group_id: "group-1",
    created_date: "2026-01-15T09:00:00Z"
  },
  {
    id: "notif-3",
    user_email: "mario.rossi@gmail.com",
    type: "message",
    title: "Nuovo messaggio in Netflix",
    content: "Admin: Prossimo pagamento il 15 gennaio",
    link: "/GroupDetail?id=group-1",
    read: false,
    group_id: "group-1",
    created_date: "2026-01-08T12:00:00Z"
  }
];

// ============================================
// 💰 PAGAMENTI
// ============================================
export const MOCK_PAYMENTS = [
  {
    id: "pay-1",
    group_id: "group-1",
    membership_id: "memb-2",
    user_email: "mario.rossi@gmail.com",
    amount: 4.50,
    platform_fee: 0.50,
    owner_amount: 4.00,
    payment_date: "2026-01-15",
    payment_method: "card",
    billing_month: "2026-01",
    status: "completed",
    created_date: "2026-01-15T09:00:00Z"
  },
  {
    id: "pay-2",
    group_id: "group-2",
    membership_id: "memb-1",
    user_email: "mario.rossi@gmail.com",
    amount: 2.67,
    platform_fee: 0.50,
    owner_amount: 2.17,
    payment_date: "2026-01-01",
    payment_method: "card",
    billing_month: "2026-01",
    status: "completed",
    created_date: "2026-01-01T10:00:00Z"
  }
];

// ============================================
// ⭐ TRUST SCORES
// ============================================
export const MOCK_TRUST_SCORES: Record<string, {
  user_email: string;
  score: number;
  phone_verified: boolean;
  kyc_verified: boolean;
  invites_count: number;
  groups_created: number;
  payments_completed: number;
  verified_badges: string[];
}> = {
  "mario.rossi@gmail.com": {
    user_email: "mario.rossi@gmail.com",
    score: 85,
    phone_verified: true,
    kyc_verified: false,
    invites_count: 3,
    groups_created: 1,
    payments_completed: 3,
    verified_badges: ["phone"]
  },
  "admin@test.it": {
    user_email: "admin@test.it",
    score: 95,
    phone_verified: true,
    kyc_verified: true,
    invites_count: 10,
    groups_created: 5,
    payments_completed: 15,
    verified_badges: ["phone", "kyc"]
  }
};

// ============================================
// 🛠️ HELPER FUNCTIONS
// ============================================

export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`❌ Errore lettura ${key}:`, error);
    return defaultValue;
  }
};

export const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`❌ Errore salvataggio ${key}:`, error);
  }
};

export const clearStorage = (): void => {
  localStorage.clear();
};

export const initMockData = (): void => {
  console.log("🚀 Inizializzazione mock data...");
  
  if (!localStorage.getItem('groups')) {
    saveToStorage('groups', MOCK_GROUPS);
  }
  if (!localStorage.getItem('memberships')) {
    saveToStorage('memberships', MOCK_MEMBERSHIPS);
  }
  if (!localStorage.getItem('messages')) {
    saveToStorage('messages', MOCK_MESSAGES);
  }
  if (!localStorage.getItem('notifications')) {
    saveToStorage('notifications', MOCK_NOTIFICATIONS);
  }
  if (!localStorage.getItem('payments')) {
    saveToStorage('payments', MOCK_PAYMENTS);
  }
  if (!localStorage.getItem('isLoggedIn')) {
    saveToStorage('isLoggedIn', false);
  }
  if (!localStorage.getItem('currentUser')) {
    saveToStorage('currentUser', MOCK_USER);
  }
  
  console.log("✨ Mock data pronto!");
};
