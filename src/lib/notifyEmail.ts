import { supabase } from "@/integrations/supabase/client";

type NotifyPayload =
  | { type: "chat_message"; group_id: string }
  | { type: "ticket"; ticket_id: string };

/**
 * Fire-and-forget email notification trigger.
 * The server decides recipients, content and anti-spam throttling.
 */
export async function notifyByEmail(payload: NotifyPayload): Promise<void> {
  try {
    await supabase.functions.invoke("notify-email", { body: payload });
  } catch (err) {
    // Never block the UI on notification failures
    console.warn("notify-email failed:", err);
  }
}
