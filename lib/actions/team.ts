"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/workspace";
import { recordAudit } from "@/lib/audit-server";
import { revalidatePath } from "next/cache";

/**
 * Open/close a team member's access to the workspace. An owner/admin can close
 * any member (owners themselves can't be closed, to avoid locking the workspace
 * out); a member can close their own. Reopening is allowed for owners/admins, or
 * for a member who closed their own account (tracked via deactivated_by).
 */
export async function setMemberActive(userId: string, active: boolean) {
  const { workspace, user, supabase } = await getWorkspace();
  const service = await createServiceClient();

  const { data: me } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();
  const isAdmin = me?.role === "owner" || me?.role === "admin";
  const isSelf = userId === user.id;

  const { data: target } = await service
    .from("workspace_members")
    .select("role, deactivated_by")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!target) return { error: "Member not found" };
  if (target.role === "owner") return { error: "Owners can't be deactivated" };

  if (active) {
    const canReactivate = isAdmin || (isSelf && target.deactivated_by === user.id);
    if (!canReactivate) return { error: "Only an admin can reopen this account" };
  } else if (!isAdmin && !isSelf) {
    return { error: "Not allowed" };
  }

  const { error } = await service
    .from("workspace_members")
    .update({ is_active: active, deactivated_by: active ? null : user.id })
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  await recordAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    actorLabel: user.email ?? null,
    action: active ? "member.reactivated" : "member.deactivated",
    metadata: { target_user_id: userId },
  });
  revalidatePath("/dashboard/settings/team");
  return { ok: true };
}

/**
 * A member reopening their own account from the suspended screen — only works
 * for a membership the same user closed themselves, not an admin-closed one.
 */
export async function reactivateSelf() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const service = await createServiceClient();
  const { data: rows } = await service
    .from("workspace_members")
    .select("workspace_id, is_active, deactivated_by")
    .eq("user_id", user.id);

  const selfClosed = (rows ?? []).filter(
    (r) => !r.is_active && r.deactivated_by === user.id
  );
  if (selfClosed.length === 0) {
    return {
      error: "Your account was closed by an admin. Contact them to reopen it.",
    };
  }
  for (const r of selfClosed) {
    await service
      .from("workspace_members")
      .update({ is_active: true, deactivated_by: null })
      .eq("workspace_id", r.workspace_id)
      .eq("user_id", user.id);
  }
  return { ok: true };
}

export async function inviteTeamMember(
  workspaceId: string,
  email: string,
  role: string
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (workspace.id !== workspaceId) {
    return { error: "Workspace mismatch" };
  }

  // Validate caller is owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return { error: "Only workspace owners can invite members" };
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { error: "A valid email address is required" };
  }

  const validRoles = ["member", "admin"];
  if (!validRoles.includes(role)) {
    return { error: "Invalid role. Must be member or admin." };
  }

  // Check if this email is already a member
  const { data: existingMembers } = await supabase
    .from("workspace_members")
    .select("user_id, workspaces!inner(id)")
    .eq("workspace_id", workspaceId);

  if (existingMembers && existingMembers.length > 0) {
    // We need to check auth.users for the email, but RLS won't let us.
    // Instead, check if there's already a pending invite for this email.
    const { data: existingInvite } = await supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", trimmedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      return { error: "An invite for this email is already pending" };
    }
  }

  const { data: invite, error: insertError } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      email: trimmedEmail,
      role,
      invited_by: user.id,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError) {
    return { error: insertError.message };
  }

  await recordAudit({
    workspaceId,
    actorId: user.id,
    actorLabel: user.email ?? null,
    action: "member.invited",
    targetLabel: trimmedEmail,
    metadata: { role },
  });
  return { ok: true, invite };
}

export async function removeTeamMember(
  workspaceId: string,
  userId: string
) {
  const { workspace, user, supabase } = await getWorkspace();

  if (workspace.id !== workspaceId) {
    return { error: "Workspace mismatch" };
  }

  // Validate caller is owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return { error: "Only workspace owners can remove members" };
  }

  // Can't remove yourself
  if (userId === user.id) {
    return { error: "You cannot remove yourself from the workspace" };
  }

  const { error: deleteError } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  await recordAudit({
    workspaceId,
    actorId: user.id,
    actorLabel: user.email ?? null,
    action: "member.removed",
    metadata: { removed_user_id: userId },
  });
  return { ok: true };
}

export async function acceptInvite(inviteId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Use service client to bypass RLS (the user is not a workspace member yet)
  const serviceClient = await createServiceClient();

  // Fetch the invite
  const { data: invite, error: fetchError } = await serviceClient
    .from("workspace_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return { error: "Invite not found" };
  }

  if (invite.status !== "pending") {
    return { error: "This invite is no longer valid" };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: "This invite has expired" };
  }

  // Verify the invite email matches the current user's email
  if (invite.email !== user.email) {
    return { error: "This invite was sent to a different email address" };
  }

  // Check if user is already a member
  const { data: existingMembership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (existingMembership) {
    // Already a member, just mark the invite as accepted
    await serviceClient
      .from("workspace_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId);

    return { ok: true, workspaceId: invite.workspace_id, alreadyMember: true };
  }

  // Insert into workspace_members (service client bypasses owner-only RLS)
  const { error: insertError } = await serviceClient
    .from("workspace_members")
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  // Update invite status to accepted
  await serviceClient
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", inviteId);

  return { ok: true, workspaceId: invite.workspace_id };
}

export async function revokeInvite(inviteId: string) {
  const { user, supabase } = await getWorkspace();

  // Fetch the invite to get workspace_id
  const { data: invite, error: fetchError } = await supabase
    .from("workspace_invites")
    .select("workspace_id")
    .eq("id", inviteId)
    .single();

  if (fetchError || !invite) {
    return { error: "Invite not found" };
  }

  // Validate caller is owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return { error: "Only workspace owners can revoke invites" };
  }

  const { error: deleteError } = await supabase
    .from("workspace_invites")
    .delete()
    .eq("id", inviteId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { ok: true };
}
