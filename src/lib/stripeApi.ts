import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';

export interface StripeApiResponse {
  ok: boolean;
  status: number;
  data: any;
}

/**
 * Returns a valid (non-expired) access token, refreshing the session when needed.
 * Returns null when the user is not signed in / the refresh token is dead.
 */
export async function getFreshAccessToken(): Promise<string | null> {
  // OAuth callbacks can render the protected page a fraction before the auth
  // client has persisted the Google session. Give hydration a short window so
  // protected financial calls are never sent with the publishable key as if it
  // were a user JWT.
  let session = (await supabase.auth.getSession()).data.session;
  for (let attempt = 0; !session && attempt < 5; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 400));
    session = (await supabase.auth.getSession()).data.session;
  }
  if (!session) return null;

  const expiresAt = (session.expires_at ?? 0) * 1000;
  // Refresh proactively when the token expires in less than 60 seconds.
  if (expiresAt && expiresAt - Date.now() > 60_000) return session.access_token;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error || !refreshed.session) return session.access_token || null;
  return refreshed.session.access_token;
}

async function callStripeApi(action: string, payload: Record<string, any>, bearer: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function stripeApi(
  action: string,
  payload: Record<string, any> = {}
): Promise<StripeApiResponse> {
  try {
    const token = await getFreshAccessToken();
    if (!token) {
      return {
        ok: false,
        status: 401,
        data: { error: "Sessione non ancora pronta. Riprova tra un istante." },
      };
    }

    let result = await callStripeApi(action, payload, token);

    // Stale/expired token: force a refresh once and retry.
    if (result.status === 401 && token) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const retryToken = refreshed?.session?.access_token;
      if (retryToken && retryToken !== token) {
        result = await callStripeApi(action, payload, retryToken);
      }
    }

    return result;
  } catch (error: any) {
    console.error('stripeApi error:', error);
    return {
      ok: false,
      status: 0,
      data: { error: 'Connessione al server fallita. Riprova.' },
    };
  }
}
