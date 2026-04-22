'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';

type ProjectMemberRole = 'owner' | 'admin' | 'member' | 'viewer' | string;

type ProjectMember = {
  id: string;
  project_id: string;
  account_id: string;
  role: ProjectMemberRole;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string | null;
};

type ProjectInvitation = {
  id: string;
  project_id: string;
  invited_account_id: string;
  invited_email: string;
  role: 'admin' | 'member' | 'viewer' | string;
  status: 'pending' | 'accepted' | 'dismissed' | string;
  invited_by: string | null;
  responded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type StudentProfile = {
  id: string;
  project_id: string;
  account_id: string | null;
  full_name: string;
  email: string | null;
  role: string | null;
  joined_at: string | null;
};

type WebsiteAccount = {
  id: string;
  name: string;
  email: string | null;
};

type SiteUserRecord = {
  accountId: string;
  name: string;
  email: string | null;
  intent: 'student-member' | 'student-member-requested' | 'administrator' | 'just-visiting';
  created_at: string | null;
  updated_at: string | null;
};

export default function MembersPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const supabase = useSupabase();

  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [websiteAccounts, setWebsiteAccounts] = useState<WebsiteAccount[]>([]);
  const [siteUsers, setSiteUsers] = useState<SiteUserRecord[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<ProjectInvitation[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [loadingWebsiteAccounts, setLoadingWebsiteAccounts] = useState(true);
  const [addingAccountId, setAddingAccountId] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [studentDetailModalOpen, setStudentDetailModalOpen] = useState(false);
  const [studentCustomName, setStudentCustomName] = useState('');
  const [savingStudentName, setSavingStudentName] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    const fetchMembers = async () => {
      setLoading(true);
      setLoadingWebsiteAccounts(true);

      const [
        {
          data: { user },
        },
        { data: projectData, error: projectError },
        { data: memberData, error: memberError },
        { data: invitationData, error: invitationError },
      ] =
        await Promise.all([
          supabase.auth.getUser(),
          (supabase as any)
            .from('projects')
            .select('owner_id')
            .eq('id', projectId)
            .maybeSingle(),
          (supabase as any)
            .from('project_members')
            .select('id, project_id, account_id, role, invited_by, joined_at, created_at')
            .eq('project_id', projectId),
          (supabase as any)
            .from('project_invitations')
            .select(
              'id, project_id, invited_account_id, invited_email, role, status, invited_by, responded_at, created_at, updated_at',
            )
            .eq('project_id', projectId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }),
        ]);

      if (projectError) {
        if (!cancelled) {
          toast.error('Failed to load project access settings');
          console.error(projectError);
          setLoadingWebsiteAccounts(false);
          setLoading(false);
        }
        return;
      }

      if (memberError) {
        if (!cancelled) {
          toast.error('Failed to load collaborators');
          console.error(memberError);
          setLoadingWebsiteAccounts(false);
          setLoading(false);
        }
        return;
      }

      if (invitationError) {
        if (!cancelled) {
          toast.error('Failed to load pending invitations');
          console.error(invitationError);
          setLoadingWebsiteAccounts(false);
          setLoading(false);
        }
        return;
      }

      const { data: studentData, error: studentError } = await (supabase as any)
        .from('member_profiles')
        .select('id, project_id, account_id, full_name, email, role, joined_at')
        .eq('project_id', projectId);

      if (studentError) {
        toast.error('Failed to load student roster');
        console.error(studentError);
      }

      let nextWebsiteAccounts: WebsiteAccount[] = [];
      let nextSiteUsers: SiteUserRecord[] = [];

      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members/accounts`, {
          credentials: 'include',
        });

        if (response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            accounts?: WebsiteAccount[];
            siteUsers?: SiteUserRecord[];
          };

          nextWebsiteAccounts = payload.accounts ?? [];
          nextSiteUsers = payload.siteUsers ?? [];
        } else if (response.status !== 403) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          toast.error(payload.error || 'Failed to load website accounts');
        }
      } catch (error) {
        console.error('Failed to load website accounts', error);
        toast.error('Failed to load website accounts');
      }

      if (cancelled) return;

      setCurrentAccountId(user?.id ?? null);
      setOwnerId((projectData?.owner_id as string | null) ?? null);
      setProjectMembers((memberData ?? []) as ProjectMember[]);
      setPendingInvitations((invitationData ?? []) as ProjectInvitation[]);
      setStudents((studentData ?? []) as StudentProfile[]);
      setWebsiteAccounts(nextWebsiteAccounts);
      setSiteUsers(nextSiteUsers);
      setLoadingWebsiteAccounts(false);
      setLoading(false);
    };

    void fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [projectId, supabase]);

  const studentsSorted = useMemo(
    () => [...students].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [students],
  );

  const filteredWebsiteAccounts = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return websiteAccounts;

    return websiteAccounts.filter((account) => {
      return (
        account.name.toLowerCase().includes(query) ||
        (account.email ?? '').toLowerCase().includes(query)
      );
    });
  }, [studentSearch, websiteAccounts]);

  const siteUsersSorted = useMemo(
    () =>
      [...siteUsers].sort(
        (a, b) =>
          siteUserSortIndex(a.intent) - siteUserSortIndex(b.intent) ||
          sortNullableDateDesc(a.updated_at, b.updated_at) ||
          a.name.localeCompare(b.name) ||
          (a.email ?? '').localeCompare(b.email ?? ''),
      ),
    [siteUsers],
  );

  const canManageRoster = useMemo(() => {
    if (!currentAccountId) return false;
    if (ownerId === currentAccountId) return true;

    const ownMembership = projectMembers.find((member) => member.account_id === currentAccountId);
    return ownMembership?.role === 'owner' || ownMembership?.role === 'admin';
  }, [currentAccountId, ownerId, projectMembers]);

  const profileByAccountId = useMemo(() => {
    const map = new Map<string, StudentProfile>();

    students.forEach((profile) => {
      if (!profile.account_id) return;
      if (!map.has(profile.account_id)) map.set(profile.account_id, profile);
    });

    return map;
  }, [students]);

  const ownerMember = useMemo(() => {
    if (ownerId) {
      const byOwnerId = projectMembers.find((member) => member.account_id === ownerId);
      if (byOwnerId) return byOwnerId;
    }

    return projectMembers.find((member) => member.role === 'owner') ?? null;
  }, [ownerId, projectMembers]);

  const collaborators = useMemo(() => {
    return projectMembers
      .filter((member) => !ownerMember || member.account_id !== ownerMember.account_id)
      .sort(
        (a, b) =>
          roleSortIndex(a.role) - roleSortIndex(b.role) ||
          sortNullableDateDesc(a.joined_at, b.joined_at) ||
          a.account_id.localeCompare(b.account_id),
      );
  }, [projectMembers, ownerMember]);

  const inviteMember = async () => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error('Enter an email address');
      return;
    }

    setInviting(true);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          role: inviteRole,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        invitation?: ProjectInvitation;
      };

      if (!response.ok || !payload.invitation) {
        throw new Error(payload.error || 'Failed to create invitation');
      }

      setPendingInvitations((prev) =>
        upsertProjectInvitation(prev, payload.invitation as ProjectInvitation),
      );
      setInviteEmail('');
      setInviteRole('member');
      setInviteModalOpen(false);
      toast.success(`Invitation sent for ${inviteRole}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add collaborator';
      toast.error(message);
    } finally {
      setInviting(false);
    }
  };

  const addWebsiteAccountToRoster = async (account: WebsiteAccount) => {
    if (!projectId) {
      toast.error('Missing project id');
      return;
    }

    setAddingAccountId(account.id);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/members/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          accountId: account.id,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        student?: StudentProfile;
        alreadyExists?: boolean;
        linkedExisting?: boolean;
      };

      if (!response.ok || !payload.student) {
        throw new Error(payload.error || 'Failed to add account to the student roster');
      }

      setStudents((prev) => upsertStudent(prev, payload.student as StudentProfile));
      setWebsiteAccounts((prev) => prev.filter((item) => item.id !== account.id));
      setSiteUsers((prev) => prev.filter((item) => item.accountId !== account.id));

      if (payload.alreadyExists) {
        toast.success(`${account.name} is already in the student roster`);
      } else if (payload.linkedExisting) {
        toast.success(`${account.name} linked to an existing student roster entry`);
      } else {
        toast.success(`${account.name} added to the student roster`);
      }

      if (websiteAccounts.length <= 1) {
        setStudentModalOpen(false);
        setStudentSearch('');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add account to the student roster';
      toast.error(message);
    } finally {
      setAddingAccountId(null);
    }
  };

  const openStudentDetails = (student: StudentProfile) => {
    setSelectedStudent(student);
    setStudentCustomName(student.full_name);
    setStudentDetailModalOpen(true);
  };

  const updateStudentName = async () => {
    if (!projectId || !selectedStudent) return;

    const nextName = studentCustomName.trim();
    if (!nextName) {
      toast.error('Enter a student name');
      return;
    }

    setSavingStudentName(true);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/members/students/${encodeURIComponent(selectedStudent.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            full_name: nextName,
          }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        student?: StudentProfile;
      };

      if (!response.ok || !payload.student) {
        throw new Error(payload.error || 'Failed to update student name');
      }

      const updatedStudent = payload.student as StudentProfile;
      setStudents((prev) => upsertStudent(prev, updatedStudent));
      setSelectedStudent(updatedStudent);
      setStudentCustomName(updatedStudent.full_name);
      toast.success('Student name updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update student name';
      toast.error(message);
    } finally {
      setSavingStudentName(false);
    }
  };

  const removeStudentFromRoster = async () => {
    if (!projectId || !selectedStudent) return;

    setRemovingStudentId(selectedStudent.id);

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/members/students/${encodeURIComponent(selectedStudent.id)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        student?: StudentProfile;
      };

      if (!response.ok || !payload.student) {
        throw new Error(payload.error || 'Failed to remove student');
      }

      const removedStudent = payload.student as StudentProfile;

      setStudents((prev) => prev.filter((student) => student.id !== removedStudent.id));

      if (removedStudent.account_id) {
        setWebsiteAccounts((prev) =>
          upsertWebsiteAccount(prev, {
            id: removedStudent.account_id,
            name: removedStudent.full_name,
            email: removedStudent.email,
          }),
        );
      }

      setStudentDetailModalOpen(false);
      setSelectedStudent(null);
      setStudentCustomName('');
      toast.success('Student removed from the class');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove student';
      toast.error(message);
    } finally {
      setRemovingStudentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Club Members</h2>
          <p className="text-muted-foreground">
            Students, owner, and collaborators with access to attendance and GoClub features.
          </p>
        </div>
        {canManageRoster && (
          <Button type="button" onClick={() => setInviteModalOpen(true)} className="h-10">
            + Invite Collaborator
          </Button>
        )}
        <div className="w-full text-xs text-muted-foreground md:text-right">
          Collaborator must already have a GoClub account. They will see the
          invitation on their dashboard and can accept or dismiss it.
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>
                  Public roster used by attendance and club-facing pages ({studentsSorted.length}{' '}
                  total).
                </CardDescription>
                {canManageRoster && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click a student to rename them or remove them from the class.
                  </p>
                )}
              </div>

              {canManageRoster && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStudentModalOpen(true)}
                  className="shrink-0"
                >
                  + Add Student
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading &&
              Array.from({ length: 4 }).map((_, index) => (
                <div key={`student-loading-${index}`} className="rounded-md border p-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted/60" />
                </div>
              ))}

            {!loading && studentsSorted.length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No students yet. Use the add student button to move website accounts into the
                attendance roster.
              </div>
            )}

            {!loading &&
              studentsSorted.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  className="w-full rounded-md border p-4 text-left transition-colors hover:bg-muted/30"
                  onClick={() => openStudentDetails(student)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{student.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.email || 'No email on file'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatJoinedLabel(student.joined_at)}
                      </p>
                    </div>
                    <Badge variant="outline">{student.role || 'student'}</Badge>
                  </div>
                </button>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner & Collaborators</CardTitle>
            <CardDescription>
              Project-level access users who can view or manage attendance and club settings (
              {projectMembers.length} total).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Owner</h3>
              {loading && <div className="h-16 animate-pulse rounded-md border bg-muted/30" />}
              {!loading && !ownerMember && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Owner membership record not found.
                </div>
              )}
              {!loading && ownerMember && (
                <AccessCard
                  member={ownerMember}
                  profile={profileByAccountId.get(ownerMember.account_id)}
                  forceRoleLabel="owner"
                />
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Pending invitations</h3>
              {loading &&
                Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`invite-loading-${index}`}
                    className="h-16 animate-pulse rounded-md border bg-muted/30"
                  />
                ))}

              {!loading && pendingInvitations.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No pending invitations.
                </div>
              )}

              {!loading &&
                pendingInvitations.map((invite) => (
                  <InvitationCard key={invite.id} invitation={invite} />
                ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Collaborators</h3>
              {loading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`collaborator-loading-${index}`}
                    className="h-16 animate-pulse rounded-md border bg-muted/30"
                  />
                ))}

              {!loading && collaborators.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No collaborators yet. Invite admins, members, or viewers to help manage the club.
                </div>
              )}

              {!loading &&
                collaborators.map((member) => (
                  <AccessCard
                    key={member.id}
                    member={member}
                    profile={profileByAccountId.get(member.account_id)}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website Users</CardTitle>
          <CardDescription>
            Signed-in users who selected a public-site role for this club ({siteUsersSorted.length}{' '}
            tracked).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingWebsiteAccounts &&
            Array.from({ length: 3 }).map((_, index) => (
              <div key={`site-user-loading-${index}`} className="rounded-md border p-4">
                <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
              </div>
            ))}

          {!loadingWebsiteAccounts && siteUsersSorted.length === 0 && (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No signed-in website users have requested roster access or marked themselves as
              visitors yet.
            </div>
          )}

          {!loadingWebsiteAccounts &&
            siteUsersSorted.map((siteUser) => (
              <div
                key={`${siteUser.accountId}-${siteUser.intent}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{siteUser.name}</p>
                    <Badge className={siteUserIntentBadgeClass(siteUser.intent)}>
                      {siteUserIntentLabel(siteUser.intent)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {siteUser.email || 'No email on file'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatSiteUserTimestamp(siteUser.updated_at || siteUser.created_at)}
                  </p>
                </div>

                {canManageRoster ? (
                  <Button
                    type="button"
                    variant={siteUser.intent === 'student-member-requested' ? 'default' : 'outline'}
                    onClick={() =>
                      void addWebsiteAccountToRoster({
                        id: siteUser.accountId,
                        name: siteUser.name,
                        email: siteUser.email,
                      })
                    }
                    disabled={addingAccountId === siteUser.accountId}
                  >
                    {addingAccountId === siteUser.accountId ? 'Adding...' : 'Add to Student Roster'}
                  </Button>
                ) : null}
              </div>
            ))}
        </CardContent>
      </Card>

      <Dialog
        open={studentModalOpen}
        onOpenChange={(open) => {
          setStudentModalOpen(open);
          if (!open) setStudentSearch('');
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Students</DialogTitle>
            <DialogDescription>
              Choose users who already created a GoClub account and add them to the student roster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search website accounts..."
            />

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {loadingWebsiteAccounts &&
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={`student-modal-loading-${index}`} className="rounded-md border p-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-muted/60" />
                  </div>
                ))}

              {!loadingWebsiteAccounts && filteredWebsiteAccounts.length === 0 && (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {websiteAccounts.length === 0
                    ? 'No website accounts are waiting to be added.'
                    : 'No website accounts match your search.'}
                </div>
              )}

              {!loadingWebsiteAccounts &&
                filteredWebsiteAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-4"
                  >
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.email || 'No email on file'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void addWebsiteAccountToRoster(account)}
                      disabled={addingAccountId === account.id}
                      variant="outline"
                    >
                      {addingAccountId === account.id ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteModalOpen}
        onOpenChange={(open) => {
          setInviteModalOpen(open);
          if (!open) {
            setInviteEmail('');
            setInviteRole('member');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Collaborator</DialogTitle>
            <DialogDescription>
              Invite an existing GoClub account to help manage this club.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="invite-email" className="text-xs text-muted-foreground">
                Collaborator Email
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                placeholder="name@example.com"
                onChange={(event) => setInviteEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void inviteMember();
                  }
                }}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="invite-role" className="text-xs text-muted-foreground">
                Role
              </label>
              <select
                id="invite-role"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole((event.target.value as 'admin' | 'member' | 'viewer') ?? 'member')
                }
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={() => void inviteMember()} disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={studentDetailModalOpen}
        onOpenChange={(open) => {
          setStudentDetailModalOpen(open);
          if (!open) {
            setSelectedStudent(null);
            setStudentCustomName('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
            <DialogDescription>
              Update this student&apos;s display name or remove them from the class roster.
            </DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-4">
              <div className="rounded-md border p-4">
                <div className="font-medium">{selectedStudent.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedStudent.email || 'No email on file'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatJoinedLabel(selectedStudent.joined_at)}
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="student-custom-name" className="text-xs text-muted-foreground">
                  Custom Name
                </label>
                <Input
                  id="student-custom-name"
                  value={studentCustomName}
                  placeholder="Student name"
                  onChange={(event) => setStudentCustomName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void updateStudentName();
                    }
                  }}
                  disabled={!canManageRoster}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeStudentFromRoster()}
                  disabled={!canManageRoster || removingStudentId === selectedStudent.id}
                >
                  {removingStudentId === selectedStudent.id ? 'Removing...' : 'Remove From Class'}
                </Button>

                <Button
                  type="button"
                  onClick={() => void updateStudentName()}
                  disabled={!canManageRoster || savingStudentName}
                >
                  {savingStudentName ? 'Saving...' : 'Save Name'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessCard({
  member,
  profile,
  forceRoleLabel,
}: {
  member: ProjectMember;
  profile?: StudentProfile;
  forceRoleLabel?: string;
}) {
  const role = forceRoleLabel || member.role || 'member';

  return (
    <div className="rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{profile?.full_name || `User ${shortId(member.account_id)}`}</p>
          <p className="text-sm text-muted-foreground">{profile?.email || member.account_id}</p>
          <p className="mt-1 text-xs text-muted-foreground">{accessSummary(role)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatJoinedLabel(member.joined_at)}</p>
        </div>
        <Badge className={roleBadgeClass(role)}>{role}</Badge>
      </div>
    </div>
  );
}

function InvitationCard({ invitation }: { invitation: ProjectInvitation }) {
  const role = invitation.role || 'member';

  return (
    <div className="rounded-md border border-dashed p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{invitation.invited_email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pending acceptance for {role} access
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent {formatCreatedLabel(invitation.created_at)}
          </p>
        </div>
        <Badge variant="outline">Pending</Badge>
      </div>
    </div>
  );
}

function accessSummary(role: string) {
  if (role === 'owner') return 'Full GoClub control, including attendance and member management.';
  if (role === 'admin') return 'Can manage collaborators, students, and attendance workflows.';
  if (role === 'member') return 'Can contribute to club content and manage attendance.';
  if (role === 'viewer') return 'Read-only access to club content and attendance records.';
  return 'Project access role.';
}

function roleBadgeClass(role: string) {
  if (role === 'owner') return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
  if (role === 'admin') return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
  if (role === 'member') return 'bg-green-100 text-green-800 hover:bg-green-100';
  if (role === 'viewer') return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
  return 'bg-muted text-muted-foreground';
}

function roleSortIndex(role: string) {
  if (role === 'admin') return 1;
  if (role === 'member') return 2;
  if (role === 'viewer') return 3;
  if (role === 'owner') return 0;
  return 4;
}

function shortId(value: string) {
  if (!value) return 'unknown';
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`;
}

function sortNullableDateDesc(a: string | null, b: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
}

function formatJoinedLabel(value: string | null) {
  if (!value) return 'Join date unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Join date unknown';
  return `Joined ${parsed.toLocaleDateString()}`;
}

function formatCreatedLabel(value: string | null) {
  if (!value) return 'recently';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'recently';
  return parsed.toLocaleDateString();
}

function formatSiteUserTimestamp(value: string | null) {
  if (!value) return 'Saved recently';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Saved recently';

  return `Updated ${parsed.toLocaleDateString()}`;
}

function siteUserIntentLabel(intent: SiteUserRecord['intent']) {
  if (intent === 'student-member-requested') return 'Requested Access';
  if (intent === 'student-member') return 'Student / Member';
  if (intent === 'administrator') return 'Administrator';
  return 'Just Visiting';
}

function siteUserIntentBadgeClass(intent: SiteUserRecord['intent']) {
  if (intent === 'student-member-requested') {
    return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
  }

  if (intent === 'student-member') {
    return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
  }

  if (intent === 'administrator') {
    return 'bg-violet-100 text-violet-800 hover:bg-violet-100';
  }

  return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
}

function siteUserSortIndex(intent: SiteUserRecord['intent']) {
  if (intent === 'student-member-requested') return 0;
  if (intent === 'student-member') return 1;
  if (intent === 'administrator') return 2;
  return 3;
}

function upsertProjectMember(current: ProjectMember[], nextMember: ProjectMember) {
  const index = current.findIndex((item) => item.account_id === nextMember.account_id);
  if (index < 0) return [nextMember, ...current];

  const next = [...current];
  next[index] = { ...next[index], ...nextMember };
  return next;
}

function upsertProjectInvitation(current: ProjectInvitation[], nextInvitation: ProjectInvitation) {
  const index = current.findIndex((item) => item.invited_account_id === nextInvitation.invited_account_id);
  if (index < 0) return [nextInvitation, ...current];

  const next = [...current];
  next[index] = { ...next[index], ...nextInvitation };
  return next;
}

function upsertStudent(current: StudentProfile[], nextStudent: StudentProfile) {
  const index = current.findIndex((item) => item.id === nextStudent.id);
  if (index < 0) return [...current, nextStudent];

  const next = [...current];
  next[index] = { ...next[index], ...nextStudent };
  return next;
}

function upsertWebsiteAccount(current: WebsiteAccount[], nextAccount: WebsiteAccount) {
  const index = current.findIndex((item) => item.id === nextAccount.id);
  if (index < 0) return [...current, nextAccount].sort((a, b) => a.name.localeCompare(b.name));

  const next = [...current];
  next[index] = { ...next[index], ...nextAccount };
  return next.sort((a, b) => a.name.localeCompare(b.name));
}
