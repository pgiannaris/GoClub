'use client';

import { useEffect, useMemo, useState } from 'react';

import { usePathname } from 'next/navigation';

import { Info, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

type OnboardingContent = {
  key: string;
  title: string;
  description: string;
  bullets: string[];
};

const STORAGE_PREFIX = 'goclub:onboarding:';

export function ContextualOnboarding() {
  const pathname = usePathname();
  const content = useMemo(() => getOnboardingContent(pathname), [pathname]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!content) {
      setVisible(false);
      return;
    }

    try {
      const hasSeen = window.localStorage.getItem(`${STORAGE_PREFIX}${content.key}`) === 'seen';
      setVisible(!hasSeen);
    } catch {
      setVisible(true);
    }
  }, [content]);

  if (!content || !visible) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${content.key}`, 'seen');
    } catch {
      // Ignore storage failures and still close the tip for this session.
    }

    setVisible(false);
  };

  return (
    <div className="px-4 pt-4 md:px-6">
      <Card className="border-blue-200/70 bg-blue-50/60 shadow-none dark:border-blue-900/70 dark:bg-blue-950/20">
        <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-full bg-blue-600/10 p-2 text-blue-700 dark:text-blue-300">
              <Info className="h-4 w-4" />
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{content.title}</p>
                <p className="text-sm text-muted-foreground">{content.description}</p>
              </div>

              <ul className="space-y-1 text-sm text-muted-foreground">
                {content.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-9 self-start"
            onClick={dismiss}
          >
            <X className="mr-1 h-4 w-4" />
            Hide tip
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function getOnboardingContent(pathname: string | null): OnboardingContent | null {
  if (!pathname) return null;

  if (pathname === '/home') {
    return {
      key: 'home',
      title: 'Start here',
      description: 'This is your club dashboard. Create a club here or open an existing one to manage it.',
      bullets: [
        'Use New club to make your first club.',
        'Open any club card to reach its overview, members, events, and attendance tools.',
        'Pending invitations show up here when another club invites you in.',
      ],
    };
  }

  if (pathname === '/home/settings') {
    return {
      key: 'profile-settings',
      title: 'Profile settings',
      description: 'Keep your account details current so your name appears correctly across the app.',
      bullets: [
        'Update your name here.',
        'Check your email and provider details.',
        'Use the account section carefully because destructive actions live here too.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+$/.test(pathname)) {
    return {
      key: 'project-overview',
      title: 'Club overview',
      description: 'This page gives you a quick snapshot of the club and its recent activity.',
      bullets: [
        'Review club status, people, meetings, and updates at a glance.',
        'Use the sidebar to jump into events, announcements, attendance, members, or editing.',
        'Come back here when you want the big picture instead of a single tool.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/events$/.test(pathname)) {
    return {
      key: 'project-events',
      title: 'Events',
      description: 'Use events to plan upcoming club meetings, sessions, or public activities.',
      bullets: [
        'Create event details and schedule them clearly.',
        'Track what is public versus internal.',
        'Keep this updated so members know what is happening next.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/announcements$/.test(pathname)) {
    return {
      key: 'project-announcements',
      title: 'Announcements',
      description: 'Announcements are for updates you want club members to notice quickly.',
      bullets: [
        'Draft updates before publishing them.',
        'Use this for reminders, important notices, and club news.',
        'Check status so you know what is live and what is still in draft.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/attendance$/.test(pathname)) {
    return {
      key: 'project-attendance',
      title: 'Attendance',
      description: 'Track who showed up, who was late, and who was excused for each meeting.',
      bullets: [
        'Record attendance from the main table.',
        'Use Meetings for session setup and Analytics or Search for deeper review.',
        'Rostered students and custom attendees can both be tracked here.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/attendance\/meetings$/.test(pathname)) {
    return {
      key: 'project-attendance-meetings',
      title: 'Attendance meetings',
      description: 'Create and manage the meeting sessions that attendance entries belong to.',
      bullets: [
        'Add a new meeting before taking attendance.',
        'Use clear dates and titles so records stay easy to read later.',
        'Decide whether each meeting should be visible outside the dashboard.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/attendance\/analytics$/.test(pathname)) {
    return {
      key: 'project-attendance-analytics',
      title: 'Attendance analytics',
      description: 'This view helps you spot trends instead of checking one meeting at a time.',
      bullets: [
        'Filter by student name or attendee type.',
        'Adjust how excused absences affect percentages.',
        'Use this page when you need patterns, not just raw records.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/attendance\/search$/.test(pathname)) {
    return {
      key: 'project-attendance-search',
      title: 'Attendance search',
      description: 'Search is the fastest way to inspect one student or one attendance pattern.',
      bullets: [
        'Type a full or partial name to narrow results quickly.',
        'Use this when someone asks about their record directly.',
        'It is better for one-off lookups than broad analytics.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/members$/.test(pathname)) {
    return {
      key: 'project-members',
      title: 'Members',
      description: 'Manage the student roster, collaborators, and invitations for this club.',
      bullets: [
        'Add or rename students here.',
        'Invite collaborators when another teacher or organizer needs access.',
        'Use this page to keep the roster clean before taking attendance.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/settings$/.test(pathname)) {
    return {
      key: 'project-settings',
      title: 'Club settings',
      description: 'Edit the core club details that appear across the dashboard.',
      bullets: [
        'Update the club name and basics here.',
        'Double-check destructive settings before saving or deleting.',
        'This is for club configuration, not daily classroom work.',
      ],
    };
  }

  if (/^\/home\/projects\/[^/]+\/editor$/.test(pathname)) {
    return {
      key: 'project-editor',
      title: 'Website editor',
      description: 'Build and update the club website pages from here.',
      bullets: [
        'Edit sections and page content visually.',
        'Use this when you want to change what visitors see.',
        'This area is separate from internal dashboard tools like attendance or members.',
      ],
    };
  }

  return null;
}
