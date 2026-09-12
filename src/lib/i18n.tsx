import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'it' | 'en' | 'es' | 'fr';

interface Translations {
  [key: string]: {
    it: string;
    en: string;
    es: string;
    fr: string;
  };
}

const translations: Translations = {
  explore: { it: 'Esplora', en: 'Explore', es: 'Explorar', fr: 'Explorer' },
  myGroups: { it: 'I Miei Gruppi', en: 'My Groups', es: 'Mis Grupos', fr: 'Mes Groupes' },
  dashboard: { it: 'Dashboard', en: 'Dashboard', es: 'Panel', fr: 'Tableau de bord' },
  messages: { it: 'Messaggi', en: 'Messages', es: 'Mensajes', fr: 'Messages' },
  notifications: { it: 'Notifiche', en: 'Notifications', es: 'Notificaciones', fr: 'Notifications' },
  wallet: { it: 'Portafoglio', en: 'Wallet', es: 'Cartera', fr: 'Portefeuille' },
  support: { it: 'Supporto', en: 'Support', es: 'Soporte', fr: 'Support' },
  settings: { it: 'Impostazioni', en: 'Settings', es: 'Ajustes', fr: 'Paramètres' },
  createGroup: { it: 'Crea Gruppo', en: 'Create Group', es: 'Crear Grupo', fr: 'Créer Groupe' },
  logout: { it: 'Esci', en: 'Logout', es: 'Salir', fr: 'Déconnexion' },
  welcomeBack: { it: 'Bentornato', en: 'Welcome back', es: 'Bienvenido', fr: 'Bienvenue' },
  activeGroups: { it: 'Gruppi Attivi', en: 'Active Groups', es: 'Grupos Activos', fr: 'Groupes Actifs' },
  monthlySpending: { it: 'Spesa Mensile', en: 'Monthly Spending', es: 'Gasto Mensual', fr: 'Dépenses Mensuelles' },
  savings: { it: 'Risparmio', en: 'Savings', es: 'Ahorro', fr: 'Économies' },
  join: { it: 'Unisciti', en: 'Join', es: 'Unirse', fr: 'Rejoindre' },
  viewGroup: { it: 'Visualizza', en: 'View', es: 'Ver', fr: 'Voir' },
  groupFull: { it: 'Gruppo Pieno', en: 'Group Full', es: 'Grupo Lleno', fr: 'Groupe Complet' },
  noGroupsYet: { it: 'Nessun gruppo ancora', en: 'No groups yet', es: 'Sin grupos aún', fr: 'Pas encore de groupes' },
  noGroupsDescription: { it: 'Unisciti o crea un nuovo gruppo per iniziare', en: 'Join or create a group to get started', es: 'Únete o crea un grupo para comenzar', fr: 'Rejoignez ou créez un groupe pour commencer' },
  browseGroups: { it: 'Esplora Gruppi', en: 'Browse Groups', es: 'Explorar Grupos', fr: 'Explorer Groupes' },
  browseDescription: { it: 'Trova gruppi pubblici a cui unirti', en: 'Find public groups to join', es: 'Encuentra grupos públicos para unirte', fr: 'Trouvez des groupes publics à rejoindre' },
  totalGroups: { it: 'Gruppi Totali', en: 'Total Groups', es: 'Grupos Totales', fr: 'Total Groupes' },
  activeMembers: { it: 'Membri Attivi', en: 'Active Members', es: 'Miembros Activos', fr: 'Membres Actifs' },
  avgSavings: { it: 'Risparmio Medio', en: 'Avg Savings', es: 'Ahorro Medio', fr: 'Économie Moyenne' },
  searchGroups: { it: 'Cerca gruppi...', en: 'Search groups...', es: 'Buscar grupos...', fr: 'Rechercher groupes...' },
  allCategories: { it: 'Tutte', en: 'All', es: 'Todas', fr: 'Toutes' },
  costPerPerson: { it: 'Costo/Persona', en: 'Cost/Person', es: 'Costo/Persona', fr: 'Coût/Personne' },
  availableSpots: { it: 'Posti Liberi', en: 'Available Spots', es: 'Lugares Libres', fr: 'Places Libres' },
  billingDate: { it: 'Data Fatturazione', en: 'Billing Date', es: 'Fecha de Facturación', fr: 'Date de Facturation' },
  dayOfMonth: { it: 'Giorno {day}', en: 'Day {day}', es: 'Día {day}', fr: 'Jour {day}' },
  noGroupsFound: { it: 'Nessun gruppo trovato', en: 'No groups found', es: 'No se encontraron grupos', fr: 'Aucun groupe trouvé' },
  joinWithCode: { it: 'Unisciti con Codice', en: 'Join with Code', es: 'Unirse con Código', fr: 'Rejoindre avec Code' },
  enterInviteCode: { it: 'Inserisci codice invito', en: 'Enter invite code', es: 'Ingresa código de invitación', fr: 'Entrez le code d\'invitation' },
  markAllRead: { it: 'Segna tutte lette', en: 'Mark all read', es: 'Marcar todas leídas', fr: 'Tout marquer lu' },
  noNotifications: { it: 'Nessuna notifica', en: 'No notifications', es: 'Sin notificaciones', fr: 'Pas de notifications' },
  noNotificationsDescription: { it: 'Le notifiche appariranno qui', en: 'Notifications will appear here', es: 'Las notificaciones aparecerán aquí', fr: 'Les notifications apparaîtront ici' },
  profile: { it: 'Profilo', en: 'Profile', es: 'Perfil', fr: 'Profil' },
  save: { it: 'Salva', en: 'Save', es: 'Guardar', fr: 'Sauvegarder' },
  personalInfo: { it: 'Informazioni Personali', en: 'Personal Information', es: 'Información Personal', fr: 'Informations Personnelles' },
  paymentSettings: { it: 'Impostazioni Pagamento', en: 'Payment Settings', es: 'Configuración de Pago', fr: 'Paramètres de Paiement' },
  name: { it: 'Nome', en: 'Name', es: 'Nombre', fr: 'Nom' },
  email: { it: 'Email', en: 'Email', es: 'Correo', fr: 'Email' },
  phone: { it: 'Telefono', en: 'Phone', es: 'Teléfono', fr: 'Téléphone' },
};

interface I18nContextType {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
  availableLanguages: Language[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('it');

  const t = (key: string, params?: Record<string, string | number>): string => {
    const translation = translations[key];
    if (!translation) return key;
    
    let text = translation[language] || translation.it || key;
    
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(`{${paramKey}}`, String(paramValue));
      });
    }
    
    return text;
  };

  const availableLanguages: Language[] = ['it', 'en', 'es', 'fr'];

  return (
    <I18nContext.Provider value={{ t, language, setLanguage, availableLanguages }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
};
