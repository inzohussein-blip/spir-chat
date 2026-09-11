"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Mail,
  Crown,
  Shield,
  User,
  Trash2,
  X,
  Clock,
  Plus,
  Loader2,
  ArrowLeft,
  Power,
  PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  inviteTeamMember,
  removeTeamMember,
  revokeInvite,
  setMemberActive,
} from "@/lib/actions/team";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useI18n } from "@/components/i18n-provider";

interface MemberDetail {
  userId: string;
  role: string;
  joinedAt: string;
  lastSeenAt: string | null;
  isAway: boolean;
  isActive: boolean;
  email: string;
  name: string;
}

/** Online when the last heartbeat is within the last ~90 seconds. */
function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 90_000;
}

/** Compact "active X ago" for a last-seen timestamp. */
function lastActive(lastSeenAt: string | null): string | null {
  if (!lastSeenAt) return null;
  const mins = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface PendingInvite {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string;
  status: string;
  created_at: string;
  expires_at: string;
}

const roleIcons: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3 w-3" />,
  admin: <Shield className="h-3 w-3" />,
  member: <User className="h-3 w-3" />,
};

const roleStyles: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-600",
};

export function TeamView({
  workspaceId,
  workspaceName,
  currentUserId,
  currentUserRole,
  members: initialMembers,
  pendingInvites: initialInvites,
}: {
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  currentUserRole: string;
  members: MemberDetail[];
  pendingInvites: PendingInvite[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const tp = t.dash.settings.teamPage;
  const isOwner = currentUserRole === "owner";
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  const [members, setMembers] = useState(initialMembers);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggleActive(userId: string, next: boolean) {
    setTogglingId(userId);
    const res = await setMemberActive(userId, next);
    if (!res.error) {
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, isActive: next } : m))
      );
    }
    setTogglingId(null);
  }
  const [invites, setInvites] = useState(initialInvites);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Remove member
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    const result = await inviteTeamMember(workspaceId, inviteEmail, inviteRole);

    if (result.error) {
      setInviteError(result.error);
    } else if (result.invite) {
      setInvites((prev) => [result.invite as PendingInvite, ...prev]);
      setInviteEmail("");
      setInviteRole("member");
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
    }

    setInviting(false);
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId);

    const result = await removeTeamMember(workspaceId, userId);

    if (!result.error) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }

    setRemovingId(null);
  }

  async function handleRevoke(inviteId: string) {
    setRevokingId(inviteId);

    const result = await revokeInvite(inviteId);

    if (!result.error) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }

    setRevokingId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{tp.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tp.manageFor.replace("{name}", workspaceName)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-8 py-8">
          {/* Members list */}
          <section>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">
                {tp.membersCount.replace("{n}", String(members.length))}
              </h2>
            </div>

            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-xl border border-border bg-card shadow-card p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      {isOnline(member.lastSeenAt) && (
                        <span
                          title={member.isAway ? tp.away : tp.online}
                          className={cn(
                            "absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-card",
                            member.isAway ? "bg-amber-500" : "bg-green-500"
                          )}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {member.name}
                        </p>
                        {member.userId === currentUserId && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {tp.you}
                          </span>
                        )}
                        {member.isAway ? (
                          <span className="shrink-0 text-[10px] font-medium text-amber-600">
                            {tp.away}
                          </span>
                        ) : isOnline(member.lastSeenAt) ? (
                          <span className="shrink-0 text-[10px] font-medium text-green-600">
                            {tp.online}
                          </span>
                        ) : (
                          lastActive(member.lastSeenAt) && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {tp.activePrefix} {lastActive(member.lastSeenAt)}
                            </span>
                          )
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                        roleStyles[member.role] ?? roleStyles.member
                      )}
                    >
                      {roleIcons[member.role] ?? roleIcons.member}
                      {member.role}
                    </span>

                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {tp.joined}{" "}
                      {new Date(member.joinedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>

                    {!member.isActive && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        {tp.closed}
                      </span>
                    )}

                    {/* Open/close a member's access. Owners can't be closed;
                        admins can toggle members, and a member can toggle self. */}
                    {member.role !== "owner" &&
                      (isAdmin || member.userId === currentUserId) && (
                        <button
                          onClick={() =>
                            handleToggleActive(member.userId, !member.isActive)
                          }
                          disabled={togglingId === member.userId}
                          title={member.isActive ? tp.closeAccount : tp.openAccount}
                          className={cn(
                            "rounded-lg p-1.5 transition-colors disabled:opacity-50",
                            member.isActive
                              ? "text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
                              : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          )}
                        >
                          {togglingId === member.userId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : member.isActive ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}

                    {isOwner && member.userId !== currentUserId && (
                      <button
                        onClick={() =>
                          setConfirmRemove({ userId: member.userId, name: member.name })
                        }
                        disabled={removingId === member.userId}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title={tp.removeMember}
                      >
                        {removingId === member.userId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Invite section (owners only) */}
          {isOwner && (
            <>
              <hr className="border-border" />

              <section>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{tp.inviteMember}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tp.inviteDesc}</p>

                <form onSubmit={handleInvite} className="mt-4 flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => {
                      setInviteEmail(e.target.value);
                      setInviteError(null);
                    }}
                    placeholder={tp.invitePlaceholder}
                    required
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="member">{tp.roleMember}</option>
                    <option value="admin">{tp.roleAdmin}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!inviteEmail.trim() || inviting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {inviting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {inviting ? tp.inviting : tp.invite}
                  </button>
                </form>

                {inviteError && (
                  <p className="mt-2 text-xs text-destructive">{inviteError}</p>
                )}
                {inviteSuccess && (
                  <p className="mt-2 text-xs text-green-600">{tp.inviteSent}</p>
                )}
              </section>
            </>
          )}

          {/* Pending invites */}
          {invites.length > 0 && (
            <>
              <hr className="border-border" />

              <section>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    {tp.pendingInvites.replace("{n}", String(invites.length))}
                  </h2>
                </div>

                <div className="mt-4 space-y-2">
                  {invites.map((invite) => {
                    const isExpired =
                      new Date(invite.expires_at) < new Date();
                    return (
                      <div
                        key={invite.id}
                        className={cn(
                          "flex items-center justify-between rounded-xl border border-border bg-card shadow-card p-4",
                          isExpired && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {invite.email}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                                  roleStyles[invite.role] ?? roleStyles.member
                                )}
                              >
                                {roleIcons[invite.role] ?? roleIcons.member}
                                {invite.role}
                              </span>
                              {isExpired ? (
                                <span className="text-[10px] text-destructive">
                                  {tp.expired}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {tp.expires}{" "}
                                  {new Date(
                                    invite.expires_at
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isOwner && (
                          <button
                            onClick={() => setConfirmRevoke(invite.id)}
                            disabled={revokingId === invite.id}
                            className="shrink-0 ml-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                            title={tp.revokeInvite}
                          >
                            {revokingId === invite.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!confirmRemove}
        title={tp.removeMember}
        message={tp.removeConfirm.replace("{name}", confirmRemove?.name ?? tp.roleMember)}
        confirmLabel={tp.remove}
        destructive
        onConfirm={() => {
          if (confirmRemove) handleRemove(confirmRemove.userId);
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
      <ConfirmDialog
        open={!!confirmRevoke}
        title={tp.revokeInvite}
        message={tp.revokeConfirm}
        confirmLabel={tp.revoke}
        destructive
        onConfirm={() => {
          if (confirmRevoke) handleRevoke(confirmRevoke);
          setConfirmRevoke(null);
        }}
        onCancel={() => setConfirmRevoke(null)}
      />
    </div>
  );
}
