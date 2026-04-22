'use client';

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import {
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  getPageSpacingStyle,
  getSiteTheme,
  HERO_ALIGN_OPTIONS,
  normalizeAccentColor,
  PAGE_BACKGROUND_OPTIONS,
  PAGE_SPACING_OPTIONS,
  resolvePageSettingsMap,
  resolveSiteSettings,
  SITE_ACCENT_OPTIONS,
  SITE_RADIUS_OPTIONS,
  SITE_SURFACE_OPTIONS,
  type Block,
  type PageBlocks,
  type PageSettings,
  type SiteContent,
  type SiteSettings,
} from '~/lib/site-content';

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEFAULT_PAGES: {
  id: string;
  label: string;
  defaultBlocks: Block[];
}[] = [
  {
    id: 'home',
    label: 'Home',
    defaultBlocks: [
      {
        type: 'hero',
        id: 'hero-1',
        content: {
          title: 'Welcome to GoClub',
          subtitle:
            'Your all-in-one hub for organizing events, sharing announcements, and keeping members connected.',
        },
      },
      {
        type: 'announcements',
        id: 'ann-1',
        settings: { limit: 4, pinnedFirst: true },
      },
      {
        type: 'events',
        id: 'events-1',
        settings: { limit: 4, showRsvp: true },
      },
      {
        type: 'members',
        id: 'members-1',
        settings: { limit: 8, layout: 'grid' },
      },
    ],
  },
  {
    id: 'about',
    label: 'About',
    defaultBlocks: [
      {
        type: 'text',
        id: 'about-1',
        content: {
          text:
            'About Our Club\n\nWe bring curious, motivated members together to learn, collaborate, and lead. From weekly meetings to major conferences, our goal is to help every member grow.',
        },
      },
      {
        type: 'features',
        id: 'about-2',
        content: {
          items: ['Student-led leadership', 'Workshops & training', 'Community outreach'],
        },
      },
    ],
  },
  {
    id: 'events',
    label: 'Events',
    defaultBlocks: [
      {
        type: 'events',
        id: 'events-2',
        settings: { limit: 6, showRsvp: true },
      },
      {
        type: 'text',
        id: 'events-desc',
        content: {
          text:
            "Upcoming Events\n\nSee what's coming next - meetings, workshops, socials, and conferences. Check back often and RSVP early to reserve your spot.",
        },
      },
    ],
  },
  {
    id: 'announcements',
    label: 'Announcements',
    defaultBlocks: [
      {
        type: 'announcements',
        id: 'ann-list',
        settings: { limit: 8, pinnedFirst: true },
      },
    ],
  },
  {
    id: 'members',
    label: 'Members',
    defaultBlocks: [
      {
        type: 'members',
        id: 'members-list',
        settings: { limit: 24, layout: 'grid' },
      },
    ],
  },
  {
    id: 'polls',
    label: 'Polls & Voting',
    defaultBlocks: [
      {
        type: 'polls',
        id: 'polls-1',
        settings: { limit: 3, allowVoting: true },
      },
    ],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    defaultBlocks: [
      {
        type: 'attendance',
        id: 'attendance-1',
        settings: { limit: 4, showCounts: true },
      },
    ],
  },
  {
    id: 'contact',
    label: 'Contact',
    defaultBlocks: [
      {
        type: 'text',
        id: 'contact-1',
        content: {
          text:
            "Get in Touch\n\nQuestions or ideas? We'd love to hear from you.\nEmail: hello@goclub.com\nInstagram: @goclub\nDiscord: goclub",
        },
      },
    ],
  },
];

type PreviewTheme = ReturnType<typeof getSiteTheme>;

const cloneBlock = (block: Block): Block => {
  if (typeof structuredClone === 'function') {
    return structuredClone(block);
  }

  return JSON.parse(JSON.stringify(block));
};

const normalizePageId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const formatPageLabel = (pageId: string) => {
  const page = DEFAULT_PAGES.find((item) => item.id === pageId);
  if (page) {
    return page.label;
  }

  return pageId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getDefaultPageBlocks = (pageId: string): PageBlocks => {
  const page = DEFAULT_PAGES.find((item) => item.id === pageId);
  return page ? page.defaultBlocks.map((block) => cloneBlock(block)) : [];
};

const getCustomPageBlocks = (): PageBlocks => [
  {
    type: 'text',
    id: crypto.randomUUID(),
    content: {
      text: 'Add your page content here...',
    },
  },
];

const sanitizePageBlocks = (blocks: PageBlocks): PageBlocks => {
  const firstHero = blocks.find((block) => block.type === 'hero');
  const nonHeroBlocks = blocks.filter((block) => block.type !== 'hero');

  return firstHero ? [firstHero, ...nonHeroBlocks] : nonHeroBlocks;
};

const sanitizePages = (pages: Record<string, PageBlocks>) =>
  Object.fromEntries(
    Object.entries(pages).map(([pageId, blocks]) => [pageId, sanitizePageBlocks(blocks)]),
  ) as Record<string, PageBlocks>;

const isHeroBlock = (block: Block | null | undefined) => block?.type === 'hero';

const canMoveBlock = (
  blocks: PageBlocks,
  index: number,
  direction: 'up' | 'down',
) => {
  const block = blocks[index];
  if (!block || isHeroBlock(block)) {
    return false;
  }

  if (direction === 'up') {
    return index > 0 && !isHeroBlock(blocks[index - 1]);
  }

  return index < blocks.length - 1;
};

export function EditorShell({ projectId }: { projectId: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);

  const [pages, setPages] = useState<{ [key: string]: PageBlocks }>({});
  const [activePage, setActivePage] = useState<string>('home');

  const [showWizard, setShowWizard] = useState(false);
  const [showPageManager, setShowPageManager] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [selectedWizardPages, setSelectedWizardPages] = useState<string[]>([
    'home',
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] =
    useState<SiteSettings>({ ...DEFAULT_SITE_SETTINGS });
  const [pageSettingsMap, setPageSettingsMap] = useState<
    Record<string, PageSettings>
  >({});
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');

  const requestedPage = useMemo(
    () => normalizePageId(searchParams?.get('page') ?? ''),
    [searchParams],
  );

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    setSelectedBlockId(null);
  }, [activePage]);

  useEffect(() => {
    if (loading || showWizard || !requestedPage) {
      return;
    }

    if (requestedPage === activePage) {
      return;
    }

    if (!pages[requestedPage]) {
      setPages((prev) => ({
        ...prev,
        [requestedPage]: getDefaultPageBlocks(requestedPage),
      }));
      setPageSettingsMap((prev) => ({
        ...prev,
        [requestedPage]: prev[requestedPage] ?? { ...DEFAULT_PAGE_SETTINGS },
      }));
    }

    setActivePage(requestedPage);
  }, [activePage, loading, pages, requestedPage, showWizard]);

  const activeBlocks = pages[activePage] ?? [];

  const selectedBlock = useMemo(
    () => activeBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [activeBlocks, selectedBlockId],
  );
  const selectedIndex = selectedBlockId
    ? activeBlocks.findIndex((block) => block.id === selectedBlockId)
    : -1;
  const canMoveSelectedUp =
    selectedIndex >= 0 ? canMoveBlock(activeBlocks, selectedIndex, 'up') : false;
  const canMoveSelectedDown =
    selectedIndex >= 0 ? canMoveBlock(activeBlocks, selectedIndex, 'down') : false;

  const activePageLabel = useMemo(
    () => (activePage ? formatPageLabel(activePage) : 'Page'),
    [activePage],
  );
  const activePageSettings = useMemo(
    () => pageSettingsMap[activePage] ?? DEFAULT_PAGE_SETTINGS,
    [activePage, pageSettingsMap],
  );
  const previewTheme = useMemo(
    () => getSiteTheme(siteSettings, activePageSettings),
    [activePageSettings, siteSettings],
  );
  const sectionSpacingStyle = useMemo(
    () => getPageSpacingStyle(activePageSettings),
    [activePageSettings],
  );

  const deviceWidthClass =
    deviceMode === 'desktop'
      ? 'max-w-5xl'
      : deviceMode === 'tablet'
        ? 'max-w-3xl'
        : 'max-w-sm';

  const pageIds = useMemo(() => Object.keys(pages), [pages]);
  const availableTemplates = useMemo(
    () => DEFAULT_PAGES.filter((page) => !pages[page.id]),
    [pages],
  );

  const setActivePageId = (
    pageId: string,
    options: { sync?: boolean } = {},
  ) => {
    const { sync = true } = options;
    setActivePage(pageId);

    if (!sync) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());
    if (pageId) {
      params.set('page', pageId);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const loadProject = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;

      setProject(data);

      const content = data.content as SiteContent;

      if (content?.pages && Object.keys(content.pages).length > 0) {
        let nextPages = content.pages;

        if (requestedPage && !nextPages[requestedPage]) {
          nextPages = {
            ...nextPages,
            [requestedPage]: getDefaultPageBlocks(requestedPage),
          };
        }

        const sanitizedPages = sanitizePages(nextPages);

        setPages(sanitizedPages);
        setSiteSettings(resolveSiteSettings(content.siteSettings));
        setPageSettingsMap(
          resolvePageSettingsMap(sanitizedPages, content.pageSettings),
        );
        setActivePage(
          requestedPage && sanitizedPages[requestedPage] ? requestedPage : 'home',
        );
      } else {
        setSiteSettings({ ...DEFAULT_SITE_SETTINGS });
        setPageSettingsMap({});
        setShowWizard(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSite = async () => {
    const newPages: { [key: string]: PageBlocks } = {};
    selectedWizardPages.forEach((pageId) => {
      newPages[pageId] = getDefaultPageBlocks(pageId);
    });
    const sanitizedPages = sanitizePages(newPages);
    const nextPageSettings = resolvePageSettingsMap(sanitizedPages);

    setPages(sanitizedPages);
    setSiteSettings({ ...DEFAULT_SITE_SETTINGS });
    setPageSettingsMap(nextPageSettings);
    setShowWizard(false);
    setActivePageId('home');
    setSelectedBlockId(null);
    await saveContent(
      sanitizedPages,
      { ...DEFAULT_SITE_SETTINGS },
      nextPageSettings,
    );
  };

  const saveContent = async (
    pagesToSave: { [key: string]: PageBlocks },
    siteSettingsToSave = siteSettings,
    pageSettingsToSave = pageSettingsMap,
  ) => {
    try {
      const { error } = await (supabase as any)
        .from('projects')
        .update({
          content: {
            pages: pagesToSave,
            siteSettings: siteSettingsToSave,
            pageSettings: pageSettingsToSave,
          },
        })
        .eq('id', projectId);

      if (error) throw error;
      toast.success('Website saved!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save website');
    }
  };

  const handleAddPage = (pageId: string, blocks?: PageBlocks) => {
    const normalized = normalizePageId(pageId);
    if (!normalized) {
      toast.error('Enter a page name');
      return;
    }

    if (pages[normalized]) {
      toast.error('That page already exists');
      return;
    }

    setPages((prev) => ({
      ...prev,
      [normalized]: sanitizePageBlocks(blocks ?? getDefaultPageBlocks(normalized)),
    }));
    setPageSettingsMap((prev) => ({
      ...prev,
      [normalized]: { ...DEFAULT_PAGE_SETTINGS },
    }));
    setSelectedBlockId(null);
    setActivePageId(normalized);
  };

  const handleAddCustomPage = () => {
    const normalized = normalizePageId(newPageName);
    if (!normalized) {
      toast.error('Enter a page name');
      return;
    }

    if (pages[normalized]) {
      toast.error('That page already exists');
      return;
    }

    setPages((prev) => ({
      ...prev,
      [normalized]: getCustomPageBlocks(),
    }));
    setPageSettingsMap((prev) => ({
      ...prev,
      [normalized]: { ...DEFAULT_PAGE_SETTINGS },
    }));
    setNewPageName('');
    setSelectedBlockId(null);
    setActivePageId(normalized);
  };

  const handleRemovePage = (pageId: string) => {
    if (pageId === 'home') {
      toast.error('The home page is required');
      return;
    }

    const remaining = pageIds.filter((id) => id !== pageId);

    setPages((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setPageSettingsMap((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });

    if (activePage === pageId) {
      const fallback = remaining[0] ?? 'home';
      setActivePageId(fallback);
    }
  };

  const handleRenamePage = (pageId: string, nextLabel: string) => {
    const normalized = normalizePageId(nextLabel);
    if (!normalized || normalized === pageId) {
      return;
    }

    if (pages[normalized]) {
      toast.error('That page already exists');
      return;
    }

    setPages((prev) => {
      const next: { [key: string]: PageBlocks } = {};
      Object.entries(prev).forEach(([id, blocks]) => {
        if (id === pageId) {
          next[normalized] = blocks;
        } else {
          next[id] = blocks;
        }
      });
      return next;
    });
    setPageSettingsMap((prev) => {
      const next: Record<string, PageSettings> = {};
      Object.entries(prev).forEach(([id, settings]) => {
        if (id === pageId) {
          next[normalized] = settings;
        } else {
          next[id] = settings;
        }
      });
      return next;
    });

    if (activePage === pageId) {
      setActivePageId(normalized);
    }
  };

  const handleUpdateSiteSettings = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => {
    setSiteSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleUpdatePageSettings = <K extends keyof PageSettings>(
    key: K,
    value: PageSettings[K],
  ) => {
    setPageSettingsMap((prev) => ({
      ...prev,
      [activePage]: {
        ...(prev[activePage] ?? { ...DEFAULT_PAGE_SETTINGS }),
        [key]: value,
      },
    }));
  };

  const updateActiveBlocks = (nextBlocks: PageBlocks) => {
    setPages((prev) => ({
      ...prev,
      [activePage]: sanitizePageBlocks(nextBlocks),
    }));
  };

  const handleUpdateBlock = (nextBlock: Block) => {
    const nextBlocks = activeBlocks.map((block) =>
      block.id === nextBlock.id ? nextBlock : block,
    );
    updateActiveBlocks(nextBlocks);
  };

  const handleDeleteBlock = (blockId: string) => {
    const targetBlock = activeBlocks.find((block) => block.id === blockId);
    if (isHeroBlock(targetBlock)) {
      toast.error('The hero stays at the top of the page');
      return;
    }

    const nextBlocks = activeBlocks.filter((block) => block.id !== blockId);
    updateActiveBlocks(nextBlocks);

    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleDuplicateBlock = (blockId: string) => {
    const index = activeBlocks.findIndex((block) => block.id === blockId);
    if (index === -1) return;
    const targetBlock = activeBlocks[index];
    if (!targetBlock) return;
    if (isHeroBlock(targetBlock)) {
      toast.error('Only one hero section is allowed');
      return;
    }

    const copy = cloneBlock(targetBlock);
    copy.id = crypto.randomUUID();

    const nextBlocks = [...activeBlocks];
    nextBlocks.splice(index + 1, 0, copy);

    updateActiveBlocks(nextBlocks);
    setSelectedBlockId(copy.id);
  };

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = activeBlocks.findIndex((block) => block.id === blockId);
    if (index === -1) return;
    if (!canMoveBlock(activeBlocks, index, direction)) {
      if (isHeroBlock(activeBlocks[index])) {
        toast.error('The hero stays pinned to the top');
      }
      return;
    }

    const nextIndex = direction === 'up' ? index - 1 : index + 1;

    const nextBlocks = [...activeBlocks];
    const [removed] = nextBlocks.splice(index, 1);
    if (!removed) return;
    nextBlocks.splice(nextIndex, 0, removed);

    updateActiveBlocks(nextBlocks);
    setSelectedBlockId(blockId);
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center text-muted-foreground">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-background text-foreground">
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="sm:max-w-xl border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Let&apos;s build your club website</DialogTitle>
            <DialogDescription>
              Select the pages you want to include in your initial site.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {DEFAULT_PAGES.map((page) => (
              <label
                key={page.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted/50"
              >
                <Checkbox
                  id={`page-${page.id}`}
                  checked={selectedWizardPages.includes(page.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedWizardPages([
                        ...selectedWizardPages,
                        page.id,
                      ]);
                    } else {
                      setSelectedWizardPages(
                        selectedWizardPages.filter((id) => id !== page.id),
                      );
                    }
                  }}
                  disabled={page.id === 'home'}
                />
                <div>
                  <div className="font-medium text-foreground">
                    {page.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {page.id === 'home'
                      ? 'Landing hero, announcements, events, roster'
                      : 'Add structured blocks you can edit later'}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSite}>Create Website</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPageManager} onOpenChange={setShowPageManager}>
        <DialogContent className="sm:max-w-2xl border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Manage Pages</DialogTitle>
            <DialogDescription>
              Add, rename, or remove pages from your club website.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Current Pages
              </div>
              <div className="space-y-2">
                {pageIds.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    No pages yet. Add one below.
                  </div>
                ) : (
                  pageIds.map((pageId) => (
                    <div
                      key={pageId}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2"
                    >
                      <Input
                        defaultValue={formatPageLabel(pageId)}
                        onBlur={(event) =>
                          handleRenamePage(pageId, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        className="h-9 flex-1 border-border bg-background text-sm text-foreground"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActivePageId(pageId);
                          setShowPageManager(false);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemovePage(pageId)}
                        disabled={pageId === 'home'}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Add Page
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTemplates.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    All default pages already added.
                  </div>
                ) : (
                  availableTemplates.map((page) => (
                    <Button
                      key={page.id}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleAddPage(page.id, getDefaultPageBlocks(page.id))
                      }
                    >
                      Add {page.label}
                    </Button>
                  ))
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  value={newPageName}
                  onChange={(event) => setNewPageName(event.target.value)}
                  placeholder="Custom page name"
                  className="h-9 flex-1 border-border bg-background text-sm text-foreground placeholder:text-muted-foreground"
                />
                <Button size="sm" onClick={handleAddCustomPage}>
                  Add Page
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPageManager(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Website Editor
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                {project?.name ?? 'Club Website'}
              </h1>
            </div>
            <div className="hidden h-8 w-px bg-border md:block" />
            <div className="flex flex-wrap gap-2">
              {pageIds.map((pageId) => (
                <button
                  key={pageId}
                  onClick={() => setActivePageId(pageId)}
                  className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                    activePage === pageId
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {formatPageLabel(pageId)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setShowPageManager(true)}>
              Pages
            </Button>
            <div className="inline-flex items-center rounded-lg border border-border bg-background p-1 shadow-xs">
              <DeviceButton
                active={deviceMode === 'desktop'}
                onClick={() => setDeviceMode('desktop')}
                icon={<Monitor className="h-4 w-4" />}
              />
              <DeviceButton
                active={deviceMode === 'tablet'}
                onClick={() => setDeviceMode('tablet')}
                icon={<Tablet className="h-4 w-4" />}
              />
              <DeviceButton
                active={deviceMode === 'mobile'}
                onClick={() => setDeviceMode('mobile')}
                icon={<Smartphone className="h-4 w-4" />}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(`/site/${projectId}`, '_blank')}
              className="gap-2"
            >
              Open site
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button onClick={() => saveContent(pages)}>Save Changes</Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <div>
                Editing <span className="font-medium">{activePageLabel}</span>
                <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground/70">
                  {deviceMode} preview
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {activeBlocks.length} section{activeBlocks.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div
            className="flex-1 overflow-y-auto p-6 md:p-8"
            style={{
              background: 'rgb(220,220,220)',
            }}
            onClick={() => setSelectedBlockId(null)}
          >
            <div className={`mx-auto w-full ${deviceWidthClass}`}>
              <div
                className="overflow-hidden bg-background"
                style={{
                  borderRadius: '0px',
                  boxShadow: 'none',
                }}
              >
                <div
                  className="min-h-[520px] overflow-hidden"
                  style={{
                    borderRadius: '0px',
                    background: previewTheme.surface,
                  }}
                >
                  {activePageSettings.showPageHeader && (
                    <PageHeaderPreview
                      pageLabel={activePageLabel}
                      intro={activePageSettings.intro}
                      theme={previewTheme}
                    />
                  )}

                  {activeBlocks.length === 0 ? (
                    <div className="p-8 md:p-10">
                      <div
                        className="rounded-xl border border-dashed px-6 py-10 text-center"
                        style={{
                          borderColor: previewTheme.border,
                          background: previewTheme.surface,
                        }}
                      >
                        <div className="text-lg font-semibold text-slate-900">
                          This page is empty
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          This template does not include editable sections on this page yet.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeBlocks.map((block, index) => (
                        <BlockRenderer
                          key={block.id}
                          block={block}
                          selected={block.id === selectedBlockId}
                          canMoveUp={canMoveBlock(activeBlocks, index, 'up')}
                          canMoveDown={canMoveBlock(activeBlocks, index, 'down')}
                          onSelect={() => setSelectedBlockId(block.id)}
                          onChange={handleUpdateBlock}
                          onDelete={() => handleDeleteBlock(block.id)}
                          onDuplicate={() => handleDuplicateBlock(block.id)}
                          onMoveUp={() => handleMoveBlock(block.id, 'up')}
                          onMoveDown={() => handleMoveBlock(block.id, 'down')}
                          heroAlign={siteSettings.heroAlign}
                          theme={previewTheme}
                          sectionSpacingStyle={sectionSpacingStyle}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-[22rem] shrink-0 border-l border-border bg-background">
          <div className="border-b border-border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Inspector
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Design Controls
            </h3>
          </div>
          <div className="h-[calc(100%-96px)] overflow-y-auto p-4">
            <EditorInspector
              pageLabel={activePageLabel}
              blockCount={activeBlocks.length}
              block={selectedBlock}
              siteSettings={siteSettings}
              pageSettings={activePageSettings}
              onUpdate={handleUpdateBlock}
              onUpdateSiteSettings={handleUpdateSiteSettings}
              onUpdatePageSettings={handleUpdatePageSettings}
              onDelete={
                selectedBlock && !isHeroBlock(selectedBlock)
                  ? () => handleDeleteBlock(selectedBlock.id)
                  : undefined
              }
              onDuplicate={
                selectedBlock && !isHeroBlock(selectedBlock)
                  ? () => handleDuplicateBlock(selectedBlock.id)
                  : undefined
              }
              onMoveUp={
                selectedBlock && canMoveSelectedUp
                  ? () => handleMoveBlock(selectedBlock.id, 'up')
                  : undefined
              }
              onMoveDown={
                selectedBlock && canMoveSelectedDown
                  ? () => handleMoveBlock(selectedBlock.id, 'down')
                  : undefined
              }
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted hover:text-foreground'
      }`}
      aria-pressed={active}
    >
      {icon}
    </button>
  );
}

function PageHeaderPreview({
  pageLabel,
  intro,
  theme,
}: {
  pageLabel: string;
  intro: string;
  theme: PreviewTheme;
}) {
  return (
    <section
      className="border-b px-6 py-10"
      style={{
        background: `linear-gradient(135deg, ${theme.accentMuted}, rgba(255,255,255,0.96))`,
        borderColor: theme.border,
      }}
    >
      <div
        className="mb-3 inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{
          background: theme.accentSoft,
          color: theme.accentText,
        }}
      >
        {pageLabel}
      </div>
      <h2 className="text-2xl font-semibold text-slate-900">{pageLabel}</h2>
      {intro ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {intro}
        </p>
      ) : (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Add a page intro from the inspector to give this page a clearer headline and context.
        </p>
      )}
    </section>
  );
}

function BlockRenderer({
  block,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  heroAlign,
  theme,
  sectionSpacingStyle,
}: {
  block: Block;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onChange: (b: Block) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  heroAlign: SiteSettings['heroAlign'];
  theme: PreviewTheme;
  sectionSpacingStyle: CSSProperties;
}) {
  const content = block.content || {};
  const settings = block.settings || {};
  const featureItems =
    Array.isArray(content.items) && content.items.length > 0
      ? content.items
      : ['Feature 1', 'Feature 2', 'Feature 3'];
  const cardStyle: CSSProperties = {
    background: theme.surface,
    borderColor: theme.border,
    borderRadius: theme.radius,
  };
  const tintedSectionStyle: CSSProperties = {
    ...sectionSpacingStyle,
    background: theme.accentMuted,
  };

  return (
    <div
      className={`group relative border-b last:border-0 transition-shadow ${
        selected ? 'shadow-[0_10px_24px_rgba(15,23,42,0.12)]' : 'hover:ring-2 hover:ring-slate-200'
      }`}
      style={
        selected
          ? {
              boxShadow: `0 0 0 2px ${theme.accentRing}, 0 10px 24px rgba(15,23,42,0.12)`,
            }
          : undefined
      }
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <div
        className={`absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border bg-white/90 p-1 shadow-sm transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{
          borderColor: theme.border,
        }}
      >
        {!isHeroBlock(block) ? (
          <>
            <IconButton
              label="Move up"
              onClick={onMoveUp}
              disabled={!canMoveUp}
            >
              <ArrowUp className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Move down"
              onClick={onMoveDown}
              disabled={!canMoveDown}
            >
              <ArrowDown className="h-4 w-4" />
            </IconButton>
            <IconButton label="Duplicate" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </IconButton>
          </>
        ) : null}
        <IconButton
          label="Delete"
          onClick={onDelete}
          disabled={isHeroBlock(block)}
          className="text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      {block.type === 'hero' && (
        <div
          className={`px-12 ${heroAlign === 'left' ? 'text-left' : 'text-center'}`}
          style={{
            ...sectionSpacingStyle,
            background: `linear-gradient(135deg, ${theme.accentMuted}, rgba(255,255,255,0.98))`,
          }}
        >
          <div className={heroAlign === 'left' ? 'mx-0 max-w-3xl' : 'mx-auto max-w-3xl'}>
            <div
              className="mb-4 inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{
                background: theme.accentSoft,
                color: theme.accentText,
              }}
            >
              Welcome section
            </div>
            <input
              value={content.title ?? ''}
              onChange={(e) =>
                onChange({
                  ...block,
                  content: { ...content, title: e.target.value },
                })
              }
              className="mb-4 w-full bg-transparent text-4xl font-semibold text-slate-900 outline-none placeholder:text-slate-400 md:text-5xl"
              placeholder="Hero title"
            />
            <input
              value={content.subtitle ?? ''}
              onChange={(e) =>
                onChange({
                  ...block,
                  content: { ...content, subtitle: e.target.value },
                })
              }
              className="w-full bg-transparent text-lg text-slate-600 outline-none placeholder:text-slate-400 md:text-xl"
              placeholder="Hero subtitle"
            />
            <div
              className={`mt-8 flex flex-wrap gap-3 ${
                heroAlign === 'left' ? 'justify-start' : 'justify-center'
              }`}
            >
              <div
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white"
                style={{ background: theme.accent }}
              >
                Primary action
              </div>
              <div
                className="rounded-lg border px-5 py-2 text-sm font-semibold text-slate-700"
                style={cardStyle}
              >
                Secondary action
              </div>
            </div>
          </div>
        </div>
      )}

      {block.type === 'text' && (
        <div className="px-8" style={sectionSpacingStyle}>
          <textarea
            value={content.text ?? ''}
            onChange={(e) =>
              onChange({
                ...block,
                content: { ...content, text: e.target.value },
              })
            }
            className="min-h-[160px] w-full resize-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Write your content..."
          />
        </div>
      )}

      {block.type === 'features' && (
        <div
          className="grid grid-cols-1 gap-4 px-8 md:grid-cols-3"
          style={sectionSpacingStyle}
        >
          {featureItems.map((item: string, i: number) => (
            <div
              key={i}
              className="p-4 shadow-sm"
              style={cardStyle}
            >
              <input
                value={item}
                onChange={(e) => {
                  const newItems = [...featureItems];
                  newItems[i] = e.target.value;
                  onChange({
                    ...block,
                    content: { ...content, items: newItems },
                  });
                }}
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                placeholder={`Feature ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {block.type === 'announcements' && (
        <div className="px-8" style={tintedSectionStyle}>
          <SectionHeader
            title="Announcements"
            hint="Shows published announcements from Supabase"
            accentColor={theme.accentText}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(Math.min(settings.limit || 3, 3)).keys()].map((i) => (
              <div
                key={i}
                className="p-4 shadow-sm"
                style={cardStyle}
              >
                <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
                <div className="mb-1 h-3 w-32 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === 'events' && (
        <div className="px-8" style={tintedSectionStyle}>
          <SectionHeader
            title="Events"
            hint="Upcoming events feed"
            accentColor={theme.accentText}
          />
          <div className="space-y-2">
            {[...Array(Math.min(settings.limit || 4, 4)).keys()].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 shadow-sm"
                style={cardStyle}
              >
                <div>
                  <div className="mb-2 h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                {settings.showRsvp && (
                  <div
                    className="h-8 w-20 rounded"
                    style={{ background: theme.accentSoft }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === 'members' && (
        <div className="px-8" style={tintedSectionStyle}>
          <SectionHeader
            title="Members"
            hint="Public roster cards"
            accentColor={theme.accentText}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {[...Array(Math.min(settings.limit || 6, 8)).keys()].map((i) => (
              <div
                key={i}
                className="h-20 shadow-sm"
                style={cardStyle}
              />
            ))}
          </div>
        </div>
      )}

      {block.type === 'polls' && (
        <div className="px-8" style={tintedSectionStyle}>
          <SectionHeader
            title="Polls & Voting"
            hint="Live polls feed"
            accentColor={theme.accentText}
          />
          <div className="space-y-2">
            {[...Array(Math.min(settings.limit || 2, 3)).keys()].map((i) => (
              <div
                key={i}
                className="p-4 shadow-sm"
                style={cardStyle}
              >
                <div className="mb-2 h-4 w-28 rounded bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-3 w-40 rounded bg-slate-100" />
                  <div className="h-3 w-32 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === 'attendance' && (
        <div className="px-8" style={tintedSectionStyle}>
          <SectionHeader
            title="Attendance"
            hint="Recent attendance sessions"
            accentColor={theme.accentText}
          />
          <div className="space-y-2">
            {[...Array(Math.min(settings.limit || 2, 3)).keys()].map((i) => (
              <div
                key={i}
                className="flex justify-between p-4 shadow-sm"
                style={cardStyle}
              >
                <div className="h-4 w-32 rounded bg-slate-200" />
                {settings.showCounts && (
                  <div className="h-4 w-16 rounded bg-slate-100" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) {
          onClick();
        }
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition ${
        disabled
          ? 'cursor-not-allowed opacity-40'
          : 'hover:bg-muted hover:text-foreground'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

function EditorInspector({
  pageLabel,
  blockCount,
  block,
  siteSettings,
  pageSettings,
  onUpdate,
  onUpdateSiteSettings,
  onUpdatePageSettings,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  pageLabel: string;
  blockCount: number;
  block: Block | null;
  siteSettings: SiteSettings;
  pageSettings: PageSettings;
  onUpdate: (block: Block) => void;
  onUpdateSiteSettings: <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => void;
  onUpdatePageSettings: <K extends keyof PageSettings>(
    key: K,
    value: PageSettings[K],
  ) => void;
  onDelete: (() => void) | undefined;
  onDuplicate: (() => void) | undefined;
  onMoveUp: (() => void) | undefined;
  onMoveDown: (() => void) | undefined;
}) {
  return (
    <div className="space-y-4">
      <InspectorSection title="Page Overview">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page</span>
          <span className="font-medium text-foreground">
            {pageLabel}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Blocks</span>
          <span className="font-medium text-foreground">
            {blockCount}
          </span>
        </div>
      </InspectorSection>

      <InspectorSection title="Site Style">
        <AccentPickerField
          label="Accent"
          value={siteSettings.accent}
          onChange={(value) => onUpdateSiteSettings('accent', value)}
        />
        <ChoiceField
          label="Surface"
          value={siteSettings.surface}
          options={SITE_SURFACE_OPTIONS}
          onChange={(value) => onUpdateSiteSettings('surface', value)}
        />
        <ChoiceField
          label="Corners"
          value={siteSettings.radius}
          options={SITE_RADIUS_OPTIONS}
          onChange={(value) => onUpdateSiteSettings('radius', value)}
        />
        <ChoiceField
          label="Hero alignment"
          value={siteSettings.heroAlign}
          options={HERO_ALIGN_OPTIONS}
          onChange={(value) => onUpdateSiteSettings('heroAlign', value)}
        />
      </InspectorSection>

      <InspectorSection title="Page Style">
        <ChoiceField
          label="Background"
          value={pageSettings.background}
          options={PAGE_BACKGROUND_OPTIONS}
          onChange={(value) => onUpdatePageSettings('background', value)}
        />
        <ChoiceField
          label="Spacing"
          value={pageSettings.spacing}
          options={PAGE_SPACING_OPTIONS}
          onChange={(value) => onUpdatePageSettings('spacing', value)}
        />
        <ToggleField
          label="Show page header"
          checked={pageSettings.showPageHeader}
          onChange={(value) => onUpdatePageSettings('showPageHeader', value)}
        />
        <TextAreaField
          label="Page intro"
          value={pageSettings.intro}
          rows={4}
          placeholder="Optional page intro shown above the sections."
          onChange={(value) => onUpdatePageSettings('intro', value)}
        />
      </InspectorSection>

      {block ? (
        <>
          <InspectorSection title="Selected Block">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize text-foreground">
                {block.type}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {block.id}
            </div>
            {isHeroBlock(block) ? (
              <p className="pt-2 text-sm text-muted-foreground">
                The hero is locked to the top of the page and cannot be duplicated or removed.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onMoveUp}
                disabled={!onMoveUp}
              >
                Move up
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onMoveDown}
                disabled={!onMoveDown}
              >
                Move down
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDuplicate}
                disabled={!onDuplicate}
              >
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onDelete}
                disabled={!onDelete}
              >
                Delete
              </Button>
            </div>
          </InspectorSection>

          <InspectorSection title="Settings">
            <BlockSettings block={block} onUpdate={onUpdate} />
          </InspectorSection>
        </>
      ) : (
        <InspectorSection title="Selection">
          <p className="text-sm text-muted-foreground">
            Click a block on the canvas to edit its settings and controls.
          </p>
        </InspectorSection>
      )}
    </div>
  );
}

function BlockSettings({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (block: Block) => void;
}) {
  const settings = block.settings || {};

  if (block.type === 'announcements') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Items"
          value={settings.limit ?? 6}
          min={1}
          max={12}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Pinned first"
          checked={settings.pinnedFirst ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, pinnedFirst: v } })
          }
        />
      </div>
    );
  }

  if (block.type === 'events') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Items"
          value={settings.limit ?? 6}
          min={1}
          max={10}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Show RSVP button"
          checked={settings.showRsvp ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, showRsvp: v } })
          }
        />
      </div>
    );
  }

  if (block.type === 'members') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Items"
          value={settings.limit ?? 12}
          min={3}
          max={48}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <SelectField
          label="Layout"
          value={settings.layout ?? 'grid'}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, layout: v } })
          }
        />
      </div>
    );
  }

  if (block.type === 'polls') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Items"
          value={settings.limit ?? 3}
          min={1}
          max={5}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Allow public voting"
          checked={settings.allowVoting ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, allowVoting: v } })
          }
        />
      </div>
    );
  }

  if (block.type === 'attendance') {
    return (
      <div className="space-y-3">
        <NumberField
          label="Items"
          value={settings.limit ?? 4}
          min={1}
          max={10}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Show counts"
          checked={settings.showCounts ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, showCounts: v } })
          }
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
      Edit text directly on the canvas for this block.
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/25 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  accentColor,
}: {
  title: string;
  hint?: string;
  accentColor?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div
          className="text-xs uppercase tracking-wide"
          style={{ color: accentColor ?? '#64748b' }}
        >
          {title}
        </div>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function AccentPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalizedValue = normalizeAccentColor(value);
  const [hexInput, setHexInput] = useState(normalizedValue);

  useEffect(() => {
    if (!open) {
      setHexInput(normalizedValue);
    }
  }, [normalizedValue, open]);

  return (
    <>
      <div className="space-y-2">
        <div className="text-sm text-foreground">{label}</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition hover:border-primary/30"
        >
          <span className="flex items-center gap-3">
            <span
              className="h-5 w-5 rounded-md border border-black/10"
              style={{ background: normalizedValue }}
            />
            <span className="text-sm text-foreground">{normalizedValue}</span>
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Edit
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md border-border bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Accent Color</DialogTitle>
            <DialogDescription>
              Pick a preset or choose your own custom brand color.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Presets
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SITE_ACCENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setHexInput(option.color);
                      onChange(option.color);
                    }}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                      normalizeAccentColor(value) === option.color
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-primary/30'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-md border border-black/10"
                      style={{ background: option.color }}
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {option.color}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Custom Color
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={normalizedValue}
                  onChange={(event) => {
                    setHexInput(event.target.value);
                    onChange(event.target.value);
                  }}
                  className="h-11 w-14 cursor-pointer rounded-md border border-border bg-background p-1"
                />
                <Input
                  value={hexInput}
                  onChange={(event) => setHexInput(event.target.value)}
                  placeholder="#4189e2"
                  className="border-border bg-background text-foreground"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  Preview
                </span>
                <span
                  className="inline-flex rounded-md px-3 py-1 text-sm font-medium text-white"
                  style={{ background: normalizeAccentColor(hexInput) }}
                >
                  Button
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHexInput(normalizedValue);
                setOpen(false);
              }}
            >
              Close
            </Button>
            <Button
              onClick={() => {
                onChange(normalizeAccentColor(hexInput));
                setOpen(false);
              }}
            >
              Apply Color
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm text-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              value === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:border-primary/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="space-y-1 text-sm text-foreground">
      <div>{label}</div>
      <Input
        type="number"
        className="border-border bg-background text-foreground"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const next = Number(e.target.value);
          const safe = Number.isFinite(next) ? next : min;
          onChange(Math.min(max, Math.max(min, safe)));
        }}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  rows = 3,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm text-foreground">
      <div>{label}</div>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span>{label}</span>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1 text-sm text-foreground">
      <div>{label}</div>
      <select
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
