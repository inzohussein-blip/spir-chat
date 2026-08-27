"use server";

import { getWorkspace } from "@/lib/workspace";
import { sendConversationMessage } from "@/lib/outbound";
import { parseMacroActions, validMacroActions, type MacroAction } from "@/lib/macros";
import type { ConversationStatus } from "@/lib/types/database";
import { revalidatePath } from "next/cache";

export async function createMacro(name: string, actions: MacroAction[]) {
  const { workspace, supabase } = await getWorkspace();
  if (!name.trim()) return { error: "Name is required" };
  const { data, error } = await supabase
    .from("macros")
    .insert({
      workspace_id: workspace.id,
      name: name.trim(),
      actions: validMacroActions(actions) as never,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/dashboard/macros");
  return { id: data.id };
}

export async function updateMacro(id: string, name: string, actions: MacroAction[]) {
  const { supabase } = await getWorkspace();
  if (!name.trim()) return { error: "Name is required" };
  const { error } = await supabase
    .from("macros")
    .update({
      name: name.trim(),
      actions: validMacroActions(actions) as never,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/macros");
  return { ok: true };
}

export async function deleteMacro(id: string) {
  const { supabase } = await getWorkspace();
  const { error } = await supabase.from("macros").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/macros");
  return { ok: true };
}

/** Run a macro's actions against one conversation. */
export async function runMacro(macroId: string, conversationId: string) {
  const { workspace, user, supabase } = await getWorkspace();

  const [{ data: macro }, { data: conversation }] = await Promise.all([
    supabase
      .from("macros")
      .select("actions")
      .eq("id", macroId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("conversations")
      .select("id, workspace_id, platform, late_conversation_id, channels(late_account_id)")
      .eq("id", conversationId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);
  if (!macro) return { error: "Macro not found" };
  if (!conversation) return { error: "Conversation not found" };

  const actions = validMacroActions(parseMacroActions(macro.actions));
  const convChannels = conversation.channels as { late_account_id: string } | null;

  for (const action of actions) {
    switch (action.type) {
      case "add_label":
        await supabase
          .from("conversation_labels")
          .upsert(
            { conversation_id: conversationId, label_id: action.value },
            { onConflict: "conversation_id,label_id", ignoreDuplicates: true }
          );
        break;
      case "remove_label":
        await supabase
          .from("conversation_labels")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("label_id", action.value);
        break;
      case "assign":
        await supabase
          .from("conversations")
          .update({ assigned_to: action.value || null })
          .eq("id", conversationId);
        break;
      case "set_status":
        await supabase
          .from("conversations")
          .update({ status: action.value as ConversationStatus })
          .eq("id", conversationId);
        break;
      case "send_message":
        await sendConversationMessage(
          supabase,
          {
            id: conversation.id,
            workspace_id: conversation.workspace_id,
            platform: conversation.platform,
            late_conversation_id: conversation.late_conversation_id,
            channels: convChannels,
          },
          action.value,
          user.id
        );
        break;
    }
  }

  revalidatePath("/dashboard/inbox");
  return { ok: true, ran: actions.length };
}
