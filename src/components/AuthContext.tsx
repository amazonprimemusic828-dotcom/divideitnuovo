import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { onAuthChange, signInWithGoogle, logout as supaLogout, AuthUser, AuthResult } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { capturePendingReferral, claimPendingReferral, prepareReferralClaim } from "@/lib/referral";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: () => Promise<AuthResult>;
  logout: () => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;
  updateUserProfile: (updates: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Al ritorno da Google il referral è nel redirect URL: acquisiscilo prima
    // che venga elaborata la prima sessione autenticata.
    capturePendingReferral();
    void prepareReferralClaim();
    const unsubscribe = onAuthChange((authUser) => {
      capturePendingReferral();
      setUser(authUser);
      setLoading(false);
      // Reclama l'eventuale codice invito: tutti i controlli sono lato database
      if (authUser?.uid) {
        void claimPendingReferral(authUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);


  // Google OAuth — redirect-based
  const login = async (): Promise<AuthResult> => {
    return await signInWithGoogle();
  };

  const logout = async () => {
    const result = await supaLogout();
    if (result.success) setUser(null);
    return result;
  };

  // Persist profile patch to Supabase auth user_metadata so it survives reloads
  const updateUserProfile = async (updates: Partial<AuthUser>): Promise<void> => {
    if (!user) return;
    setUser({ ...user, ...updates });
    const data: Record<string, any> = {};
    if ("full_name" in updates) data.full_name = updates.full_name ?? null;
    if ("avatar_url" in updates) {
      data.avatar_url = updates.avatar_url ?? null;
      data.picture = updates.avatar_url ?? null;
    }
    if ("phone" in updates) data.phone = updates.phone ?? null;
    if (Object.keys(data).length === 0) return;
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw new Error(error.message);

    // Keep the avatar/name shown inside groups in sync with the profile
    if (user.email && ("avatar_url" in updates || "full_name" in updates)) {
      const patch: { user_avatar_url?: string | null; user_name?: string } = {};
      if ("avatar_url" in updates) patch.user_avatar_url = updates.avatar_url ?? null;
      if ("full_name" in updates && updates.full_name) patch.user_name = updates.full_name;
      if (Object.keys(patch).length > 0) {
        await supabase
          .from("memberships")
          .update(patch)
          .eq("user_email", user.email.toLowerCase());
      }
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve essere usato dentro AuthProvider");
  }
  return context;
}
