// AI auto-reply from the Help Center (RAG-lite). Retrieves the most relevant
// published articles by keyword overlap and asks the model to answer using only
// them, returning a confidence flag so callers can hand off when unsure.
// Best-effort: any failure is a no-op (returns null).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { generateText, createGateway } from "ai";

type Client = SupabaseClient<Database>;

export interface AiAnswer {
  answer: string;
  confident: boolean;
}

export async function generateHelpCenterAnswer(
  supabase: Client,
  workspaceId: string,
  apiKey: string | undefined,
  question: string
): Promise<AiAnswer | null> {
  const key = apiKey || process.env.AI_GATEWAY_API_KEY;
  if (!key || !question.trim()) return null;

  const { data: articles } = await supabase
    .from("kb_articles")
    .select("title, body")
    .eq("workspace_id", workspaceId)
    .eq("is_published", true)
    .limit(50);
  if (!articles || articles.length === 0) return null;

  // Rank articles by keyword overlap with the question.
  const words = new Set(
    question
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  const ranked = articles
    .map((a) => {
      const hay = `${a.title} ${a.body}`.toLowerCase();
      let score = 0;
      for (const w of words) if (hay.includes(w)) score++;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score);
  const top = (ranked[0]?.score ? ranked.filter((r) => r.score > 0) : ranked).slice(0, 3);

  const context = top
    .map((r) => `# ${r.a.title}\n${r.a.body.slice(0, 1500)}`)
    .join("\n\n---\n\n");

  try {
    const gw = createGateway({ apiKey: key });
    const { text: raw } = await generateText({
      model: gw("openai/gpt-4o-mini"),
      system:
        "You are a friendly customer-support assistant. Answer the customer's " +
        "question using ONLY the provided Help Center articles. Never invent " +
        "facts not in the articles. Respond with ONLY minified JSON " +
        '{"answer": string, "confident": boolean}. Set confident=true only when ' +
        "the articles clearly answer the question. Keep the answer under 80 words.",
      messages: [
        { role: "user", content: `Articles:\n${context}\n\nQuestion: ${question.slice(0, 500)}` },
      ],
      temperature: 0.2,
      maxOutputTokens: 250,
    });

    const parsed = JSON.parse(raw.trim().replace(/^```json?|```$/g, "").trim());
    if (typeof parsed.answer !== "string" || !parsed.answer.trim()) return null;
    return { answer: parsed.answer.trim().slice(0, 1000), confident: parsed.confident === true };
  } catch {
    return null;
  }
}
