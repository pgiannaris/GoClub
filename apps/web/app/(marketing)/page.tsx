import type { ReactNode } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import {
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  FileText,
  Globe2,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Users2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  CtaButton,
  FeatureCard,
  FeatureGrid,
  FeatureShowcase,
  FeatureShowcaseIconContainer,
  Hero,
} from '@kit/ui/marketing';

import { AppLogo } from '~/components/app-logo';
import landingPageImage from '~/components/landingpage.png';
import { withI18n } from '~/lib/i18n/with-i18n';

import LandingPageCTA from './_components/LandingPageCTA';
import { ScrollReveal } from './_components/scroll-reveal';

const audienceSegments = [
  'Engineering clubs',
  'Student government',
  'Cultural organizations',
  'Competition teams',
  'Volunteer groups',
  'Campus communities',
];

const operatingMoments = [
  {
    icon: Globe2,
    title: 'Launch a real public site, not another half-finished page',
    body: 'Go from sign-up link to a polished club website with a homepage, branded sections, and navigation that matches how your team actually works.',
    detail:
      'Public pages and internal operations stay connected instead of drifting apart.',
  },
  {
    icon: Users2,
    title: 'Keep membership organized across every handoff',
    body: 'Roles, access, member directories, and project participation live in one place so new officers do not spend weeks rebuilding context.',
    detail:
      'The roster becomes the source of truth for leadership, staff, and members.',
  },
  {
    icon: CalendarDays,
    title: 'Run events with the same system you use to communicate',
    body: 'Publish upcoming meetings, attach details, track participation, and keep members aligned without switching between forms, spreadsheets, and chat threads.',
    detail:
      'Events, announcements, and attendance stay tied to the same club record.',
  },
  {
    icon: Megaphone,
    title: 'Announce updates without losing the thread',
    body: 'Share news, pin what matters, and keep your homepage fresh without asking someone to edit a site by hand every week.',
    detail:
      'Leadership can publish quickly while still keeping the site clean and current.',
  },
];

const productAreas = [
  {
    icon: LayoutDashboard,
    name: 'Website and brand',
    description:
      'Build a homepage that feels intentional, update it quickly, and keep your public presence aligned with what your club is doing this week.',
    points: ['Custom pages', 'Branded sections', 'Clear navigation'],
  },
  {
    icon: ShieldCheck,
    name: 'Member operations',
    description:
      'Organize access, protect internal tools, and make it obvious who can publish, manage attendance, or update records.',
    points: [
      'Sign-in and roles',
      'Structured permissions',
      'Safer admin workflows',
    ],
  },
  {
    icon: BarChart3,
    name: 'Day-to-day coordination',
    description:
      'Keep announcements, events, polls, and attendance inside one workflow so the team can spend less time stitching tools together.',
    points: ['Announcements', 'Events and polls', 'Attendance tracking'],
  },
];

const lifecycleStages = [
  {
    title: 'Before the semester starts',
    summary:
      'Set up the public site, assign leadership roles, and create the core pages every member expects to find.',
    items: [
      'Homepage and info pages',
      'Officer access',
      'Member onboarding path',
    ],
  },
  {
    title: 'During the busiest weeks',
    summary:
      'Publish updates, keep meetings visible, and track what is happening without rebuilding the same message in five different tools.',
    items: ['Announcements', 'Event publishing', 'Attendance sessions'],
  },
  {
    title: 'When leadership changes over',
    summary:
      'Pass the system on with a real operating history instead of a folder full of disconnected links and documents.',
    items: [
      'Persistent structure',
      'Shared records',
      'Faster officer transitions',
    ],
  },
];

const systemBenefits = [
  {
    icon: FileText,
    label: 'One place for context',
    text: 'Pages, updates, and team workflows stop drifting into separate tools.',
  },
  {
    icon: BellRing,
    label: 'Faster weekly operations',
    text: 'Publishing, scheduling, and attendance become repeatable instead of manual.',
  },
  {
    icon: CheckCircle2,
    label: 'Cleaner member experience',
    text: 'Members know where to go for updates, events, and next steps.',
  },
];

function SectionEyebrow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`dark:border-border/60 dark:bg-card dark:text-foreground inline-flex w-fit items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium tracking-tight text-slate-700 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function Home() {
  return (
    <main className="dark:bg-background dark:text-foreground bg-white text-slate-950">
      <div className="mt-4 flex flex-col space-y-24 py-14 md:space-y-28">
        <section className="container mx-auto">
          <PersonalHeroSection />
        </section>

        <section className="container mx-auto">
          <FeatureShowcase
            heading={
              <>
                <b className="font-semibold text-slate-950 dark:text-white">
                  Everything your club needs
                </b>
                .{' '}
                <span className="dark:text-muted-foreground font-normal text-slate-600">
                  Keep your website, memberships, communication, events, and
                  projects organized in one place.
                </span>
              </>
            }
            icon={
              <FeatureShowcaseIconContainer className="dark:border-border dark:bg-background rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                <LayoutDashboard className="h-5" />
                <span>Built for club operations</span>
              </FeatureShowcaseIconContainer>
            }
          >
            <FeatureGrid>
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Beautiful Club Dashboard"
                description="Manage your club's website, events, and content with a clean and intuitive dashboard."
              />
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Secure Authentication"
                description="Allow members to sign in safely using email, Google, or other authentication providers."
              />
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Club Memberships"
                description="Easily manage club members, roles, and access to features within your club."
              />
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Payment Integration"
                description="Accept membership fees and donations through multiple payment gateways."
              />
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Event & Project Management"
                description="Plan, schedule, and track club events or projects directly from your dashboard."
              />
              <FeatureCard
                className="dark:border-border/60 dark:bg-card dark:text-card-foreground relative col-span-1 overflow-hidden border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg"
                label="Role-Based Permissions"
                description="Assign roles and permissions so members only access what they need."
              />
            </FeatureGrid>
          </FeatureShowcase>
        </section>

        <section className="dark:border-border dark:bg-muted/20 border-y border-slate-200 bg-slate-50/70 py-10">
          <div className="container mx-auto">
            <ScrollReveal>
              <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
                <div>
                  <SectionEyebrow>Built for organized teams</SectionEyebrow>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl dark:text-white">
                    Keep the cleaner original landing page feel, then go deeper
                    as people scroll.
                  </h2>
                </div>

                <div className="dark:text-muted-foreground grid grid-cols-2 gap-3 text-sm text-slate-700 sm:grid-cols-3">
                  {audienceSegments.map((segment) => (
                    <div
                      key={segment}
                      className="dark:border-border/60 dark:bg-card dark:text-foreground rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                    >
                      {segment}
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section id="platform" className="container mx-auto">
          <ScrollReveal>
            <div className="max-w-3xl">
              <SectionEyebrow>Longer product story</SectionEyebrow>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-5xl dark:text-white">
                The homepage now keeps selling the product after the first
                screen.
              </h2>
              <p className="dark:text-muted-foreground mt-5 text-lg leading-8 text-slate-600">
                The old top section is back. Under it, the page now has room to
                explain how GoClub works across public pages, members, events,
                and weekly operations.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-16 grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
            <ScrollReveal className="lg:sticky lg:top-28 lg:self-start">
              <div className="dark:border-border/60 dark:bg-card rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_35px_90px_-60px_rgba(15,23,42,0.25)]">
                <div className="dark:bg-muted/30 rounded-[1.5rem] bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="dark:text-muted-foreground text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">
                        GoClub flow
                      </div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        A cleaner loop for every week of the term
                      </div>
                    </div>
                    <div className="dark:bg-background/80 rounded-2xl bg-white p-3 shadow-sm">
                      <LayoutDashboard className="h-6 w-6 text-[#4189e2]" />
                    </div>
                  </div>

                  <div className="mt-6 space-y-3">
                    {[
                      'Update the public page',
                      'Publish what is happening next',
                      'Manage who can do what',
                      'Track what actually happened',
                    ].map((step, index) => (
                      <div
                        key={step}
                        className="dark:bg-background/80 flex items-center gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm"
                      >
                        <span className="dark:bg-primary/15 flex h-8 w-8 items-center justify-center rounded-xl bg-[#edf4ff] text-sm font-semibold text-[#4189e2]">
                          0{index + 1}
                        </span>
                        <span className="dark:text-foreground text-sm font-medium text-slate-700">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollReveal>

            <div className="space-y-6">
              {operatingMoments.map((item, index) => {
                const Icon = item.icon;

                return (
                  <ScrollReveal key={item.title} delay={index * 80}>
                    <article className="dark:border-border/60 dark:bg-card rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_35px_80px_-65px_rgba(15,23,42,0.24)]">
                      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-2xl">
                          <div className="dark:bg-primary/15 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ff]">
                            <Icon className="h-6 w-6 text-[#4189e2]" />
                          </div>
                          <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                            {item.title}
                          </h3>
                          <p className="dark:text-muted-foreground mt-4 text-base leading-7 text-slate-600">
                            {item.body}
                          </p>
                        </div>

                        <div className="dark:bg-muted/30 dark:text-muted-foreground max-w-sm rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                          {item.detail}
                        </div>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="container mx-auto">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.96fr] lg:items-center">
            <ScrollReveal>
              <div className="max-w-3xl">
                <SectionEyebrow>Dashboard showcase</SectionEyebrow>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-5xl dark:text-white">
                  Show the system in action without changing the whole site into
                  a dark landing page.
                </h2>
                <p className="dark:text-muted-foreground mt-5 text-lg leading-8 text-slate-600">
                  This section keeps the product-company pacing you wanted, but
                  it sits on a white light-theme surface so the page still feels
                  like the original site.
                </p>

                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                  {[
                    [
                      'Shared operations',
                      'A public website and internal workspace built from the same source.',
                    ],
                    [
                      'Officer clarity',
                      'Everyone knows where updates, roles, and records live.',
                    ],
                    [
                      'Less rework',
                      'Teams stop rewriting the same event information across tools.',
                    ],
                    [
                      'More continuity',
                      'New leadership inherits a system, not a scramble.',
                    ],
                  ].map(([title, copy], index) => (
                    <ScrollReveal key={title} delay={120 + index * 60}>
                      <div className="dark:border-border/60 dark:bg-muted/30 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="text-base font-semibold text-slate-950 dark:text-white">
                          {title}
                        </div>
                        <div className="dark:text-muted-foreground mt-2 text-sm leading-6 text-slate-600">
                          {copy}
                        </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={140}>
              <div className="dark:border-border/60 dark:bg-card rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_40px_100px_-70px_rgba(15,23,42,0.35)]">
                <div className="dark:border-border/60 dark:bg-muted/30 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="dark:border-border/60 flex items-end justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="dark:text-muted-foreground text-xs tracking-[0.28em] text-slate-500 uppercase">
                        Interface preview
                      </div>
                      <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                        Public-facing quality with internal depth
                      </div>
                    </div>
                    <div className="dark:text-muted-foreground text-right text-sm text-slate-500">
                      Editor, members, announcements, events
                    </div>
                  </div>

                  <div className="dark:border-border/60 dark:bg-card mt-4 overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white">
                    <Image
                      src="/images/dashboard-header.webp"
                      alt="GoClub interface detail"
                      width={2880}
                      height={1800}
                      className="h-auto w-full"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="dark:border-border/60 dark:bg-card rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="dark:text-muted-foreground text-xs tracking-[0.24em] text-slate-500 uppercase">
                        Surface one
                      </div>
                      <div className="dark:text-muted-foreground mt-2 text-sm leading-6 text-slate-600">
                        The landing page sells the club clearly to visitors and
                        prospective members.
                      </div>
                    </div>
                    <div className="dark:border-border/60 dark:bg-card rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="dark:text-muted-foreground text-xs tracking-[0.24em] text-slate-500 uppercase">
                        Surface two
                      </div>
                      <div className="dark:text-muted-foreground mt-2 text-sm leading-6 text-slate-600">
                        The internal workspace gives leadership the tools to
                        keep the site and the operation in sync.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="container mx-auto">
          <ScrollReveal>
            <div className="max-w-3xl">
              <SectionEyebrow>Core product areas</SectionEyebrow>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-5xl dark:text-white">
                Three big ideas, presented like a platform instead of a short
                feature list.
              </h2>
            </div>
          </ScrollReveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {productAreas.map((area, index) => {
              const Icon = area.icon;

              return (
                <ScrollReveal key={area.name} delay={index * 80}>
                  <article className="dark:border-border/60 dark:bg-card flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_35px_90px_-75px_rgba(15,23,42,0.3)]">
                    <div className="dark:bg-primary/15 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4ff]">
                      <Icon className="h-7 w-7 text-[#4189e2]" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {area.name}
                    </h3>
                    <p className="dark:text-muted-foreground mt-4 text-base leading-7 text-slate-600">
                      {area.description}
                    </p>
                    <div className="mt-8 space-y-3">
                      {area.points.map((point) => (
                        <div
                          key={point}
                          className="dark:bg-muted/30 dark:text-foreground flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                        >
                          <CheckCircle2 className="h-4 w-4 text-[#4189e2]" />
                          {point}
                        </div>
                      ))}
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        <section className="container mx-auto">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <ScrollReveal className="lg:sticky lg:top-28 lg:self-start">
              <div className="dark:border-border/60 dark:bg-muted/30 rounded-[2rem] border border-slate-200 bg-slate-50 p-8">
                <SectionEyebrow>Full-season rhythm</SectionEyebrow>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 dark:text-white">
                  A better system is most obvious when the semester gets messy.
                </h2>
                <p className="dark:text-muted-foreground mt-5 text-lg leading-8 text-slate-600">
                  The page now has enough room to show how GoClub works before
                  launch, during the rush, and after leadership turns over.
                </p>
                <div className="dark:border-border/60 mt-8 border-t border-slate-200 pt-6">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl bg-slate-950 px-6 text-base font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                  >
                    <Link href="/auth/sign-up">
                      <span className="flex items-center gap-2">
                        Start building
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </Button>
                </div>
              </div>
            </ScrollReveal>

            <div className="space-y-6">
              {lifecycleStages.map((stage, index) => (
                <ScrollReveal key={stage.title} delay={index * 90}>
                  <article className="dark:border-border/60 dark:bg-card rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_35px_80px_-65px_rgba(15,23,42,0.24)]">
                    <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-start">
                      <div>
                        <div className="dark:text-muted-foreground text-xs font-semibold tracking-[0.3em] text-slate-500 uppercase">
                          Phase 0{index + 1}
                        </div>
                        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                          {stage.title}
                        </h3>
                        <p className="dark:text-muted-foreground mt-4 text-base leading-7 text-slate-600">
                          {stage.summary}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {stage.items.map((item) => (
                          <div
                            key={item}
                            className="dark:bg-muted/30 dark:text-foreground rounded-2xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-700"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="dark:border-border dark:bg-muted/20 border-y border-slate-200 bg-slate-50/70 py-24 md:py-28">
          <div className="container mx-auto">
            <ScrollReveal>
              <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="max-w-2xl">
                  <SectionEyebrow>Why this works</SectionEyebrow>
                  <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-5xl dark:text-white">
                    More depth, but still clearly the same landing page.
                  </h2>
                  <p className="dark:text-muted-foreground mt-5 text-lg leading-8 text-slate-600">
                    The original top of the page stays familiar. The added
                    sections give visitors and club leadership more proof
                    without turning the page into a different brand direction.
                  </p>
                </div>

                <div className="grid gap-4">
                  {systemBenefits.map((benefit, index) => {
                    const Icon = benefit.icon;

                    return (
                      <ScrollReveal
                        key={benefit.label}
                        delay={120 + index * 70}
                      >
                        <div className="dark:border-border/60 dark:bg-card flex gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6">
                          <div className="dark:bg-primary/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf4ff]">
                            <Icon className="h-5 w-5 text-[#4189e2]" />
                          </div>
                          <div>
                            <div className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                              {benefit.label}
                            </div>
                            <div className="dark:text-muted-foreground mt-2 text-sm leading-7 text-slate-600">
                              {benefit.text}
                            </div>
                          </div>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        <section className="container mx-auto">
          <ScrollReveal>
            <div className="dark:border-border/60 dark:bg-card relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white px-8 py-12 md:px-12 md:py-14">
              <div className="absolute top-0 right-0 h-56 w-56 rounded-full bg-[#4189e2]/10 blur-3xl" />
              <div className="absolute bottom-0 left-12 h-40 w-40 rounded-full bg-sky-100 blur-3xl dark:bg-sky-500/10" />

              <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="max-w-3xl">
                  <SectionEyebrow className="gap-3">
                    <AppLogo href={null} width={24} className="h-6 w-6" />
                    Final call
                  </SectionEyebrow>
                  <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-balance text-slate-950 md:text-5xl dark:text-white">
                    Keep the cleaner landing page you liked, but make it feel
                    like a fuller product story.
                  </h2>
                  <p className="dark:text-muted-foreground mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                    The top is familiar again. The page is longer. The light
                    theme stays white. The extra motion and depth now support
                    the original design instead of replacing it.
                  </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row lg:flex-col">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl bg-[#4189e2] px-6 text-base font-semibold text-white hover:bg-[#3678cc]"
                  >
                    <Link href="/auth/sign-up">
                      <span className="flex items-center gap-2">
                        Start your site
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="dark:border-border/60 dark:bg-background dark:hover:bg-muted/40 h-12 rounded-xl border-slate-300 bg-white px-6 text-base text-slate-950 hover:bg-slate-50 dark:text-white"
                  >
                    <Link href="/faq">Read the FAQ</Link>
                  </Button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </div>
    </main>
  );
}

export default withI18n(Home);

function PersonalHeroSection() {
  return (
    <Hero
      title={
        <>
          <span className="block text-slate-950 dark:text-white">
            The{' '}
            <span className="font-semibold text-[#4189e2]">
              all-in-one platform
            </span>
          </span>
          <span className="block text-slate-950 dark:text-white">
            for your club&apos;s management
          </span>
        </>
      }
      subtitle={
        <span>
          Launch your website, manage members, run events, and collect payments
          from one dashboard built for clubs.
        </span>
      }
      cta={<MainCallToActionButton />}
      image={
        <Image
          priority
          className="dark:border-primary/10 rounded-2xl border border-slate-200"
          src={landingPageImage}
          alt="GoClub dashboard"
        />
      }
    />
  );
}

function MainCallToActionButton() {
  return (
    <div className="flex space-x-4">
      <CtaButton>
        <Link href="/auth/sign-up">
          <span className="flex items-center space-x-0.5">
            <span>
              <LandingPageCTA />
            </span>

            <ArrowRight className="h-4" />
          </span>
        </Link>
      </CtaButton>

      <CtaButton variant="link">
        <Link href="#platform">Learn More</Link>
      </CtaButton>
    </div>
  );
}
