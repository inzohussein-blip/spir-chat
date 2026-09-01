"use server";

import { getWorkspace } from "@/lib/workspace";
import { composeAssist, isComposeMode } from "@/lib/ai/compose";

/** Rewrite an agent's draft reply with the AI assistant. */
export async function assistReply(mode: string, text: string) {
  if (!isComposeMode(mode)) return { error: "Unknown action" };
  if (!text.trim()) return { error: "Write a draft first" };
  const { workspace } = await getWorkspace();
  const result = await composeAssist(workspace.ai_api_key ?? undefined, mode, text);
  if (!result) {
    return { error: "AI is unavailable — add an AI key in Settings or try again." };
  }
  return { text: result };
}
