"use server";

import { getWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { applySegment, parseSegmentRules } from "@/lib/segments";
import type { SequenceStep } from "@/lib/types/database";

// Cap a single bulk enrollment so the action stays within request limits.
const MAX_SEGMENT_ENROLL = 500;

export async function createSequence(name: string) {
  const { workspace, supabase } = await getWorkspace();

  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required" };

  const { data, error } = await supabase
    .from("sequences")
    .insert({ workspace_id: workspace.id, name: trimmed })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  return { ok: true, sequence: data };
}

export async function updateSequence(
  sequenceId: string,
  updates: {
    name?: string;
    description?: string | null;
    steps?: SequenceStep[];
    status?: "draft" | "active" | "paused";
  }
) {
  const { workspace, supabase } = await getWorkspace();

  // Verify ownership
  const { data: existing } = await supabase
    .from("sequences")
    .select("id")
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!existing) return { error: "Sequence not found" };

  const { data, error } = await supabase
    .from("sequences")
    .update({
      ...updates,
      steps: updates.steps ? JSON.parse(JSON.stringify(updates.steps)) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sequenceId)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return { ok: true, sequence: data };
}

export async function deleteSequence(sequenceId: string) {
  const { workspace, supabase } = await getWorkspace();

  const { error } = await supabase
    .from("sequences")
    .delete()
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/sequences");
  return { ok: true };
}

export async function enrollContact(
  sequenceId: string,
  contactId: string,
  channelId: string
) {
  const { workspace, supabase } = await getWorkspace();

  // Verify sequence ownership
  const { data: sequence } = await supabase
    .from("sequences")
    .select("id, steps, status")
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id)
    .single();

  if (!sequence) return { error: "Sequence not found" };
  if (sequence.status !== "active") return { error: "Sequence is not active" };

  const steps = (sequence.steps as unknown as SequenceStep[]) || [];
  if (steps.length === 0) return { error: "Sequence has no steps" };

  // Calculate next_step_at based on first step
  let nextStepAt: string;
  const firstStep = steps[0];
  if (firstStep.type === "delay" && firstStep.delayMinutes) {
    nextStepAt = new Date(
      Date.now() + firstStep.delayMinutes * 60 * 1000
    ).toISOString();
  } else {
    // Message step: execute now
    nextStepAt = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("sequence_enrollments")
    .insert({
      sequence_id: sequenceId,
      contact_id: contactId,
      channel_id: channelId,
      next_step_at: nextStepAt,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Contact is already enrolled in this sequence" };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return { ok: true, enrollment: data };
}

/**
 * Enroll every contact matching a saved segment into a sequence. Each contact
 * is enrolled on their most recent conversation's channel (a contact with no
 * conversation can't be messaged, so they're skipped). Already-enrolled
 * contacts are skipped via the (sequence_id, contact_id) unique constraint.
 */
export async function enrollSegment(sequenceId: string, segmentId: string) {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: sequence }, { data: segment }] = await Promise.all([
    supabase
      .from("sequences")
      .select("id, steps, status")
      .eq("id", sequenceId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    supabase
      .from("segments")
      .select("rules")
      .eq("id", segmentId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
  ]);

  if (!sequence) return { error: "Sequence not found" };
  if (!segment) return { error: "Segment not found" };
  if (sequence.status !== "active") return { error: "Sequence is not active" };

  const steps = (sequence.steps as unknown as SequenceStep[]) || [];
  if (steps.length === 0) return { error: "Sequence has no steps" };

  // Contacts matching the segment.
  let query = supabase
    .from("contacts")
    .select("id")
    .eq("workspace_id", workspace.id);
  query = applySegment(query, parseSegmentRules(segment.rules));
  const { data: contacts } = await query.limit(MAX_SEGMENT_ENROLL);

  const contactIds = (contacts ?? []).map((c) => c.id);
  if (contactIds.length === 0) {
    return { ok: true, enrolled: 0, skipped: 0, noChannel: 0 };
  }

  // Most recent conversation channel per contact (rows come newest-first, so
  // the first one seen for a contact is their latest).
  const { data: convs } = await supabase
    .from("conversations")
    .select("contact_id, channel_id, last_message_at")
    .eq("workspace_id", workspace.id)
    .in("contact_id", contactIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const channelByContact = new Map<string, string>();
  for (const c of convs ?? []) {
    if (!channelByContact.has(c.contact_id)) {
      channelByContact.set(c.contact_id, c.channel_id);
    }
  }

  // next_step_at from the first step (delay waits, message runs now).
  const firstStep = steps[0];
  const nextStepAt =
    firstStep.type === "delay" && firstStep.delayMinutes
      ? new Date(Date.now() + firstStep.delayMinutes * 60 * 1000).toISOString()
      : new Date().toISOString();

  let noChannel = 0;
  const rows = [];
  for (const contactId of contactIds) {
    const channelId = channelByContact.get(contactId);
    if (!channelId) {
      noChannel += 1;
      continue;
    }
    rows.push({
      sequence_id: sequenceId,
      contact_id: contactId,
      channel_id: channelId,
      next_step_at: nextStepAt,
    });
  }

  let enrolled = 0;
  if (rows.length > 0) {
    // ignoreDuplicates skips contacts already enrolled (unique constraint).
    const { data: inserted } = await supabase
      .from("sequence_enrollments")
      .upsert(rows, { onConflict: "sequence_id,contact_id", ignoreDuplicates: true })
      .select("id");
    enrolled = inserted?.length ?? 0;
  }

  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return {
    ok: true,
    enrolled,
    skipped: rows.length - enrolled,
    noChannel,
  };
}

/** Set (or clear) the tag that auto-enrolls contacts into this sequence. */
export async function setSequenceTriggerTag(sequenceId: string, tagId: string | null) {
  const { workspace, supabase } = await getWorkspace();
  const { error } = await supabase
    .from("sequences")
    .update({ trigger_tag_id: tagId || null })
    .eq("id", sequenceId)
    .eq("workspace_id", workspace.id);
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/sequences/${sequenceId}`);
  return { ok: true };
}

export async function cancelEnrollment(enrollmentId: string) {
  const { workspace, supabase } = await getWorkspace();

  // Verify the enrollment belongs to a sequence in this workspace
  const { data: enrollment } = await supabase
    .from("sequence_enrollments")
    .select("id, sequence_id, sequences!inner(workspace_id)")
    .eq("id", enrollmentId)
    .single();

  if (!enrollment) return { error: "Enrollment not found" };

  const seq = enrollment.sequences as unknown as { workspace_id: string };
  if (seq.workspace_id !== workspace.id) {
    return { error: "Enrollment not found" };
  }

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({ status: "cancelled" })
    .eq("id", enrollmentId);

  if (error) return { error: error.message };

  revalidatePath(`/dashboard/sequences/${enrollment.sequence_id}`);
  return { ok: true };
}
