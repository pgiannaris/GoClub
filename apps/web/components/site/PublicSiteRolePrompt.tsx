'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from 'sonner';

const STORAGE_PREFIX = 'public-site-role-prompt';
type SiteRoleChoice =
  | 'student-member'
  | 'student-member-requested'
  | 'administrator'
  | 'just-visiting';

export function PublicSiteRolePrompt(props: {
  projectId: string;
  userId: string;
}) {
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${props.projectId}:${props.userId}`,
    [props.projectId, props.userId],
  );
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'role' | 'student-request'>('role');
  const [savingChoice, setSavingChoice] = useState<SiteRoleChoice | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hasAnswered = window.localStorage.getItem(storageKey);

    if (!hasAnswered) {
      setOpen(true);
    }
  }, [storageKey]);

  const rememberChoice = (role: SiteRoleChoice) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, role);
    }
  };

  const persistChoice = async (intent: SiteRoleChoice) => {
    setSavingChoice(intent);

    try {
      const response = await fetch(
        `/api/public/projects/${encodeURIComponent(props.projectId)}/site-role`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({ intent }),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to save your site role');
      }

      rememberChoice(intent);
      setOpen(false);

      if (intent === 'student-member-requested') {
        toast.success('Access request sent. Admins can now review you on the members page.');
      }

      if (intent === 'just-visiting') {
        toast.success('Saved. You will appear as a visitor for admins reviewing website users.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save your site role';
      toast.error(message);
    } finally {
      setSavingChoice(null);
    }
  };

  const handleStudentMember = () => {
    setStep('student-request');
  };

  const handleAdministrator = () => {
    void persistChoice('administrator');
  };

  const handleJustVisiting = () => {
    void persistChoice('just-visiting');
  };

  const handleStudentRequest = () => {
    void persistChoice('student-member-requested');
  };

  const handleStudentNotNow = () => {
    void persistChoice('student-member');
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen && setOpen(true)}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        {step === 'role' ? (
          <>
            <DialogHeader>
              <DialogTitle>What brings you here?</DialogTitle>
              <DialogDescription>
                Choose the option that fits you best. Students and members can
                ask to join the class roster. Administrators stay here too, and
                can review website users and approve who gets added.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                If you are a student or member, you can request to join the
                class. Once you are on the roster, you will get more access to
                this website.
              </p>
              <p>
                If you are just visiting, you can keep browsing without being
                placed on the roster.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                onClick={handleStudentMember}
                type="button"
                disabled={Boolean(savingChoice)}
              >
                I&apos;m a Student / Member
              </Button>

              <Button
                onClick={handleAdministrator}
                type="button"
                variant="outline"
                disabled={Boolean(savingChoice)}
              >
                I&apos;m an Administrator
              </Button>

              <Button
                onClick={handleJustVisiting}
                type="button"
                variant="ghost"
                disabled={Boolean(savingChoice)}
              >
                {savingChoice === 'just-visiting' ? 'Saving...' : 'Just Visiting'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request to join the class?</DialogTitle>
              <DialogDescription>
                If you request to join, you will be added to the website user
                list so an administrator can review and approve you for the
                roster. Students on the roster get more access to the website.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:justify-start">
              <Button onClick={handleStudentRequest} type="button" disabled={Boolean(savingChoice)}>
                {savingChoice === 'student-member-requested' ? 'Saving...' : 'Yes, request access'}
              </Button>

              <Button
                onClick={handleStudentNotNow}
                type="button"
                variant="outline"
                disabled={Boolean(savingChoice)}
              >
                {savingChoice === 'student-member' ? 'Saving...' : 'Not now'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
