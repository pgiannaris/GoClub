'use client';

import { useEffect, useMemo, useState } from 'react';

import { toast } from 'sonner';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';

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

    if (hasAnswered) return;

    let cancelled = false;

    const checkPromptEligibility = async () => {
      try {
        const response = await fetch(
          `/api/public/projects/${encodeURIComponent(props.projectId)}/site-role`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );

        if (!response.ok) {
          if (!cancelled) setOpen(true);
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as {
          shouldPrompt?: boolean;
        };

        if (cancelled) return;

        if (payload.shouldPrompt) {
          setOpen(true);
        } else {
          // Known users should not see the role popup repeatedly.
          rememberChoice('student-member');
          setOpen(false);
        }
      } catch {
        if (!cancelled) setOpen(true);
      }
    };

    void checkPromptEligibility();

    return () => {
      cancelled = true;
    };
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
        toast.success(
          'Access request sent. Admins can now review you on the members page.',
        );
      }

      if (intent === 'just-visiting') {
        toast.success(
          'Saved. You will appear as a visitor for admins reviewing website users.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to save your site role';
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
      <DialogContent className="max-h-[80vh] w-full max-w-[92vw] p-10 sm:max-w-xl md:max-w-2xl">
        {step === 'role' ? (
          <div className="space-y-6">
            <DialogHeader className="space-y-3">
              <DialogTitle>What brings you here?</DialogTitle>
              <DialogDescription className="text-sm">
                Pick the option that fits you. Students can request roster
                access; admins can review site users.
              </DialogDescription>
            </DialogHeader>

            <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
              <p className="break-words whitespace-normal">
                Students and members can request to join the class roster to
                gain additional access.
              </p>
              <p className="break-words whitespace-normal">
                If you&apos;re just visiting, continue browsing as a visitor.
              </p>
            </div>

            <DialogFooter className="gap-3 pt-2 sm:justify-start">
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
                {savingChoice === 'just-visiting'
                  ? 'Saving...'
                  : 'Just Visiting'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <DialogHeader className="space-y-3">
              <DialogTitle>Request to join the class?</DialogTitle>
              <DialogDescription className="text-sm">
                Requesting adds you to the site user list for admin review.
                Approved students receive additional access.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-3 pt-2 sm:justify-start">
              <Button
                onClick={handleStudentRequest}
                type="button"
                disabled={Boolean(savingChoice)}
              >
                {savingChoice === 'student-member-requested'
                  ? 'Saving...'
                  : 'Yes, request access'}
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
