import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { buildCorsHeaders, checkRateLimit } from "../_shared/security.ts";

// Validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// SECURITY (audit punto 3): single identity system — Supabase Auth only.
// The old Firebase JWKS verification produced Firebase uids that never matched
// the Supabase UUIDs used across all other tables, breaking authorization.
async function verifySupabaseToken(
  token: string,
): Promise<{ uid: string; email?: string } | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return { uid: data.user.id, email: data.user.email ?? undefined };
  } catch (error) {
    console.error("Token verification error:", (error as Error).message);
    return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const idToken = authHeader.replace('Bearer ', '');

    // Verify Supabase JWT (single identity system)
    const tokenData = await verifySupabaseToken(idToken);
    if (!tokenData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { uid, email } = tokenData;

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: 60 messages/min per user
    const allowed = await checkRateLimit(supabase, uid, 'chat-messages', 60, 60);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Troppi messaggi. Rallenta.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // Handle POST (send message)
    if (req.method === 'POST') {
      const { group_id, message, sender_name, sender_avatar, message_type } = body;

      // Validate input
      if (!group_id || !isValidUUID(group_id)) {
        return new Response(
          JSON.stringify({ error: 'Invalid or missing group_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Message is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (message.length > 5000) {
        return new Response(
          JSON.stringify({ error: 'Message too long (max 5000 characters)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validMessageTypes = ['text', 'image', 'file', 'system'];
      const finalMessageType = validMessageTypes.includes(message_type) ? message_type : 'text';

      // IDOR protection: only group members (or the group admin) can post
      if (email) {
        const [{ data: membership }, { data: group }] = await Promise.all([
          supabase
            .from('memberships')
            .select('id')
            .eq('group_id', group_id)
            .eq('user_email', email)
            .maybeSingle(),
          supabase
            .from('groups')
            .select('admin_email')
            .eq('id', group_id)
            .maybeSingle(),
        ]);
        const isMember = !!membership;
        const isGroupAdmin = group?.admin_email?.toLowerCase() === email.toLowerCase();
        if (!isMember && !isGroupAdmin) {
          return new Response(
            JSON.stringify({ error: 'Non sei membro di questo gruppo' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Insert message
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          group_id,
          sender_uid: uid,
          sender_name: sender_name || 'Utente',
          sender_avatar: sender_avatar || null,
          message: message.trim(),
          message_type: finalMessageType
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to send message', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`💬 Message sent by ${uid} to group ${group_id}`);
      
      return new Response(
        JSON.stringify({ success: true, message: newMessage }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle DELETE (delete message)
    if (req.method === 'DELETE') {
      const { message_id } = body;

      if (!message_id || !isValidUUID(message_id)) {
        return new Response(
          JSON.stringify({ error: 'Invalid or missing message_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First check if the message belongs to this user
      const { data: existingMessage, error: fetchError } = await supabase
        .from('messages')
        .select('sender_uid')
        .eq('id', message_id)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify message ownership' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!existingMessage) {
        return new Response(
          JSON.stringify({ error: 'Message not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingMessage.sender_uid !== uid) {
        return new Response(
          JSON.stringify({ error: 'You can only delete your own messages' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete the message
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', message_id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete message' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`🗑️ Message ${message_id} deleted by ${uid}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
