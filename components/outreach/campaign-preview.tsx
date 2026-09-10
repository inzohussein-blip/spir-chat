"use client";

import { CheckCheck, Image as ImageIcon, FileText, Video, ExternalLink } from "lucide-react";
import { renderMergeVariables } from "@/lib/merge";
import type { OutreachChannel } from "@/lib/outreach";

interface TemplatePreview {
  name: string;
  lang: string;
  params: string[];
  headerText: string;
  headerMediaType: "" | "image" | "document" | "video";
  headerMediaUrl: string;
  buttonParam: string;
}

/**
 * Live WhatsApp-style chat preview of a campaign message, so you see exactly how
 * the outbound bubble reads before sending. Mirrors the inbox conversation look:
 * a phone chat frame with an outbound bubble, timestamp, and delivery ticks.
 */
export function CampaignPreview({
  channel,
  templateMode,
  message,
  subject,
  sampleRecipient,
  template,
}: {
  channel: OutreachChannel;
  templateMode: boolean;
  message: string;
  subject: string;
  sampleRecipient: string | null;
  template: TemplatePreview;
}) {
  const isEmail = channel === "email";
  const sample = sampleRecipient || (isEmail ? "you@example.com" : "+964 7xx xxx xxxx");

  // Resolve {{phone}}/{{email}}/{{name}} tokens against a sample recipient.
  const merge = (text: string) =>
    renderMergeVariables(text, {
      display_name: null,
      email: isEmail ? sample : null,
      phone: isEmail ? null : sample,
    });

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bodyText = templateMode ? "" : merge(message);
  const headerText = templateMode && template.headerText ? merge(template.headerText) : "";
  const hasMediaHeader = templateMode && !!template.headerMediaType;
  const params = templateMode ? template.params.map(merge).filter(Boolean) : [];
  const hasButton = templateMode && !!template.buttonParam.trim();

  const empty =
    !templateMode && !bodyText.trim()
      ? true
      : templateMode && !template.name.trim() && params.length === 0 && !headerText && !hasMediaHeader
      ? true
      : false;

  const MediaIcon =
    template.headerMediaType === "document"
      ? FileText
      : template.headerMediaType === "video"
      ? Video
      : ImageIcon;

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-card">
      {/* Chat header (WhatsApp-style) */}
      <div className="flex items-center gap-2.5 bg-[#075E54] px-3 py-2.5 text-white dark:bg-emerald-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
          {sample.replace(/[^0-9a-z]/gi, "").slice(-2).toUpperCase() || "WA"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{sample}</p>
          <p className="text-[10px] leading-tight text-white/70">
            {isEmail ? "Email preview" : "WhatsApp • preview"}
          </p>
        </div>
      </div>

      {/* Chat body */}
      <div className="min-h-[180px] space-y-2 bg-[#efeae2] px-3 py-3 dark:bg-neutral-900">
        {empty ? (
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Your message preview appears here.
          </p>
        ) : (
          <div className="flex justify-end">
            <div className="max-w-[85%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] text-neutral-900 shadow-sm dark:bg-emerald-700 dark:text-neutral-50">
              {/* Media header */}
              {hasMediaHeader && (
                <div className="flex h-24 items-center justify-center bg-black/5 dark:bg-black/20">
                  <MediaIcon className="h-8 w-8 opacity-50" />
                </div>
              )}
              <div className="px-2.5 py-1.5">
                {/* Email subject line */}
                {isEmail && subject.trim() && (
                  <p className="mb-1 text-sm font-bold">{merge(subject)}</p>
                )}
                {/* Text header */}
                {headerText && <p className="mb-1 text-sm font-bold">{headerText}</p>}

                {/* Body */}
                {templateMode ? (
                  <div className="space-y-1 text-sm">
                    {template.name.trim() && (
                      <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-100/70">
                        {template.name} · {template.lang}
                      </p>
                    )}
                    {params.length > 0 ? (
                      <p className="whitespace-pre-wrap break-words">
                        {params.map((p, i) => (
                          <span key={i}>
                            {i > 0 && " "}
                            <span className="rounded bg-black/10 px-1 dark:bg-white/15">{p}</span>
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300">
                        Body variables render here as you fill them in.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">{bodyText}</p>
                )}

                {/* Timestamp + ticks */}
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-200/70">
                    {now}
                  </span>
                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                </div>
              </div>

              {/* Button */}
              {hasButton && (
                <div className="border-t border-black/10 dark:border-white/10">
                  <div className="flex items-center justify-center gap-1.5 px-2 py-2 text-sm font-medium text-sky-600 dark:text-sky-300">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {merge(template.buttonParam)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
