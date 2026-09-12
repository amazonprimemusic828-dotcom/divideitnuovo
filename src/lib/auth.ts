import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { getPendingReferral, getPendingReferralTicket, prepareReferralClaim } from "@/lib/referral";

export interface AuthUser {
  uid: string;          // mapped from supabase user.id (UUID)
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  needsConfirmation?: boolean;
}

function mapUser(u: User | null | undefined): AuthUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, any>;
  return {
    uid: u.id,
    email: u.email ?? null,
    full_name: meta.full_name ?? meta.name ?? null,
    avatar_url: meta.avatar_url ?? meta.picture ?? null,
    phone: u.phone ?? null,
  };
}

export function userFromSession(session: Session | null): AuthUser | null {
  return mapUser(session?.user ?? null);
}

// -------------------- Email / Password --------------------
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: { full_name: fullName },
    },
  });
  if (error) return { success: false, error: friendly(error.message) };
  // If email confirmation is required, session will be null
  return {
    success: true,
    user: mapUser(data.user) ?? undefined,
    needsConfirmation: !data.session,
  };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, user: mapUser(data.user) ?? undefined };
}

// -------------------- Magic Link --------------------
export async function signInWithMagicLink(email: string): Promise<AuthResult> {
  const preparedTicket = await prepareReferralClaim();
  const ref = getPendingReferral();
  const ticket = preparedTicket || getPendingReferralTicket();
  const callbackParams = new URLSearchParams({ oauth: "callback" });
  if (ref) callbackParams.set("ref", ref.toUpperCase());
  if (ref && ticket) callbackParams.set("ref_ticket", ticket);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/Auth?${callbackParams.toString()}`,
    },
  });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true };
}

// -------------------- Google OAuth --------------------
export async function signInWithGoogle(): Promise<AuthResult> {
  const preparedTicket = await prepareReferralClaim();
  // Il codice referral viaggia nel redirectTo così sopravvive al giro su Google
  // anche quando localStorage viene perso (Safari / incognito).
  let ref: string | null = null;
  try {
    ref = getPendingReferral();
  } catch {
    ref = null;
  }
  const ticket = preparedTicket || getPendingReferralTicket();
  const callbackParams = new URLSearchParams();
  if (ref) callbackParams.set("ref", ref.toUpperCase());
  if (ref && ticket) callbackParams.set("ref_ticket", ticket);
  callbackParams.set("oauth", "callback");
  const redirectTo = `${window.location.origin}/Auth${
    callbackParams.size ? `?${callbackParams.toString()}` : ""
  }`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { success: false, error: friendly(error.message) };
  // Redirect happens — function returns before completing
  return { success: true };
}


// -------------------- Password Reset --------------------
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: friendly(error.message) };
  return { success: true, user: mapUser(data.user) ?? undefined };
}

// -------------------- Logout --------------------
export async function logout(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.signOut();
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// -------------------- Session listener --------------------
export function onAuthChange(callback: (user: AuthUser | null) => void) {
  // Register listener first
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(mapUser(session?.user ?? null));
  });
  // Then fetch existing session
  supabase.auth.getSession().then(({ data }) => {
    callback(mapUser(data.session?.user ?? null));
  });
  return () => sub.subscription.unsubscribe();
}

// -------------------- Helpers --------------------
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o password non corretti";
  if (m.includes("email not confirmed"))
    return "Devi confermare l'email prima di accedere. Controlla la tua casella.";
  if (m.includes("user already registered"))
    return "Questa email è già registrata";
  if (m.includes("password should be at least"))
    return "La password deve avere almeno 6 caratteri";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Troppi tentativi. Riprova più tardi.";
  return msg;
}
