'use client';

import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  GripVertical,
  Image,
  Layers,
  LayoutGrid,
  Mail,
  Megaphone,
  Monitor,
  PanelLeft,
  Plus,
  Redo2,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Undo2,
  Users,
  X,
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
  type Block,
  DEFAULT_PAGE_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  HERO_ALIGN_OPTIONS,
  PAGE_BACKGROUND_OPTIONS,
  PAGE_SPACING_OPTIONS,
  type PageBlocks,
  type PageSettings,
  SITE_ACCENT_OPTIONS,
  SITE_RADIUS_OPTIONS,
  SITE_SURFACE_OPTIONS,
  type SiteContent,
  type SiteSettings,
  getPageSpacingStyle,
  getSiteTheme,
  normalizeAccentColor,
  resolvePageSettingsMap,
  resolveSiteSettings,
} from '~/lib/site-content';

// ─── Types ───────────────────────────────────────────────────────────────────

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type SidebarTab = 'blocks' | 'layers' | 'design';

// ─── Block Library ────────────────────────────────────────────────────────────

const BLOCK_LIBRARY = [
  {
    category: 'Content',
    items: [
      {
        type: 'hero',
        label: 'Hero',
        icon: Image,
        description: 'Big headline banner',
      },
      {
        type: 'text',
        label: 'Text',
        icon: Type,
        description: 'Rich text section',
      },
      {
        type: 'features',
        label: 'Features',
        icon: LayoutGrid,
        description: 'Feature cards grid',
      },
    ],
  },
  {
    category: 'Club Data',
    items: [
      {
        type: 'announcements',
        label: 'Announcements',
        icon: Megaphone,
        description: 'Latest posts',
      },
      {
        type: 'events',
        label: 'Events',
        icon: Calendar,
        description: 'Upcoming events',
      },
      {
        type: 'members',
        label: 'Members',
        icon: Users,
        description: 'Member roster',
      },
      {
        type: 'polls',
        label: 'Polls',
        icon: BarChart2,
        description: 'Live voting polls',
      },
      {
        type: 'attendance',
        label: 'Attendance',
        icon: CheckSquare,
        description: 'Session records',
      },
      {
        type: 'tasks',
        label: 'Tasks',
        icon: ClipboardList,
        description: 'Open tasks',
      },
    ],
  },
  {
    category: 'Other',
    items: [
      {
        type: 'contact',
        label: 'Contact',
        icon: Mail,
        description: 'Contact information',
      },
    ],
  },
];

// ─── Default Pages ────────────────────────────────────────────────────────────

const DEFAULT_PAGES: { id: string; label: string; defaultBlocks: Block[] }[] = [
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
          text: 'About Our Club\n\nWe bring curious, motivated members together to learn, collaborate, and lead.',
        },
      },
      {
        type: 'features',
        id: 'about-2',
        content: {
          items: [
            'Student-led leadership',
            'Workshops & training',
            'Community outreach',
          ],
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
    id: 'tasks',
    label: 'Tasks',
    defaultBlocks: [
      {
        type: 'tasks',
        id: 'tasks-1',
        settings: { limit: 6, showStatus: true },
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
          text: "Get in Touch\n\nQuestions or ideas? We'd love to hear from you.\nEmail: hello@goclub.com",
        },
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cloneBlock = (block: Block): Block =>
  typeof structuredClone === 'function'
    ? structuredClone(block)
    : JSON.parse(JSON.stringify(block));

const normalizePageId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const formatPageLabel = (pageId: string) => {
  const page = DEFAULT_PAGES.find((p) => p.id === pageId);
  if (page) return page.label;
  return pageId
    .split('-')
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
};

const getDefaultPageBlocks = (pageId: string): PageBlocks => {
  const page = DEFAULT_PAGES.find((p) => p.id === pageId);
  return page ? page.defaultBlocks.map(cloneBlock) : [];
};

const isHeroBlock = (block: Block | null | undefined) => block?.type === 'hero';

const canMoveBlock = (
  blocks: PageBlocks,
  index: number,
  direction: 'up' | 'down',
) => {
  const block = blocks[index];
  if (!block || isHeroBlock(block)) return false;
  if (direction === 'up') return index > 0 && !isHeroBlock(blocks[index - 1]);
  return index < blocks.length - 1;
};

const sanitizePageBlocks = (blocks: PageBlocks): PageBlocks => {
  const firstHero = blocks.find((b) => b.type === 'hero');
  const nonHero = blocks.filter((b) => b.type !== 'hero');
  return firstHero ? [firstHero, ...nonHero] : nonHero;
};

const sanitizePages = (pages: Record<string, PageBlocks>) =>
  Object.fromEntries(
    Object.entries(pages).map(([id, blocks]) => [
      id,
      sanitizePageBlocks(blocks),
    ]),
  ) as Record<string, PageBlocks>;

const getBlockIcon = (type: string) => {
  const found = BLOCK_LIBRARY.flatMap((cat) => cat.items).find(
    (item) => item.type === type,
  );
  return found?.icon ?? Layers;
};

const getBlockLabel = (type: string) => {
  const found = BLOCK_LIBRARY.flatMap((cat) => cat.items).find(
    (item) => item.type === type,
  );
  return found?.label ?? type;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditorShell({ projectId }: { projectId: string }) {
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<Record<string, PageBlocks>>({});
  const [activePage, setActivePage] = useState<string>('home');
  const [showWizard, setShowWizard] = useState(false);
  const [showPageManager, setShowPageManager] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [selectedWizardPages, setSelectedWizardPages] = useState<string[]>([
    'home',
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    ...DEFAULT_SITE_SETTINGS,
  });
  const [pageSettingsMap, setPageSettingsMap] = useState<
    Record<string, PageSettings>
  >({});
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('blocks');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);

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
    if (loading || showWizard || !requestedPage || requestedPage === activePage)
      return;
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
    () => activeBlocks.find((b) => b.id === selectedBlockId) ?? null,
    [activeBlocks, selectedBlockId],
  );
  const selectedIndex = selectedBlockId
    ? activeBlocks.findIndex((b) => b.id === selectedBlockId)
    : -1;
  const canMoveSelectedUp =
    selectedIndex >= 0
      ? canMoveBlock(activeBlocks, selectedIndex, 'up')
      : false;
  const canMoveSelectedDown =
    selectedIndex >= 0
      ? canMoveBlock(activeBlocks, selectedIndex, 'down')
      : false;

  const activePageLabel = useMemo(
    () => formatPageLabel(activePage),
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

  const deviceWidth =
    deviceMode === 'desktop'
      ? '100%'
      : deviceMode === 'tablet'
        ? '768px'
        : '390px';

  const pageIds = useMemo(() => Object.keys(pages), [pages]);
  const availableTemplates = useMemo(
    () => DEFAULT_PAGES.filter((p) => !pages[p.id]),
    [pages],
  );

  // ─── Page Navigation ─────────────────────────────────────────────────────

  const setActivePageId = (
    pageId: string,
    options: { sync?: boolean } = {},
  ) => {
    const { sync = true } = options;
    setActivePage(pageId);
    if (!sync) return;
    const params = new URLSearchParams(searchParams?.toString());
    if (pageId) params.set('page', pageId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ─── Data ────────────────────────────────────────────────────────────────

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
        const sanitized = sanitizePages(nextPages);
        setPages(sanitized);
        setSiteSettings(resolveSiteSettings(content.siteSettings));
        setPageSettingsMap(
          resolvePageSettingsMap(sanitized, content.pageSettings),
        );
        setActivePage(
          requestedPage && sanitized[requestedPage] ? requestedPage : 'home',
        );
      } else {
        setSiteSettings({ ...DEFAULT_SITE_SETTINGS });
        setPageSettingsMap({});
        setShowWizard(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async (
    pagesToSave = pages,
    siteSettingsToSave = siteSettings,
    pageSettingsToSave = pageSettingsMap,
  ) => {
    setSaving(true);
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
      toast.success('Changes saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Block Operations ─────────────────────────────────────────────────────

  const updateActiveBlocks = (nextBlocks: PageBlocks) => {
    setPages((prev) => ({
      ...prev,
      [activePage]: sanitizePageBlocks(nextBlocks),
    }));
  };

  const handleAddBlock = (type: string) => {
    const newBlock: Block = {
      type,
      id: crypto.randomUUID(),
      content:
        type === 'hero'
          ? { title: 'Section Title', subtitle: 'Add a subtitle here.' }
          : type === 'text'
            ? { text: 'Add your content here...' }
            : type === 'features'
              ? { items: ['Feature 1', 'Feature 2', 'Feature 3'] }
              : undefined,
      settings:
        type === 'announcements'
          ? { limit: 4, pinnedFirst: true }
          : type === 'events'
            ? { limit: 4, showRsvp: true }
            : type === 'members'
              ? { limit: 8, layout: 'grid' }
              : type === 'polls'
                ? { limit: 3, allowVoting: true }
                : type === 'attendance'
                  ? { limit: 4, showCounts: true }
                  : type === 'tasks'
                    ? { limit: 6, showStatus: true }
                    : undefined,
    };

    if (type === 'hero' && activeBlocks.some((b) => b.type === 'hero')) {
      toast.error('Only one hero per page');
      return;
    }

    const nextBlocks = [...activeBlocks, newBlock];
    updateActiveBlocks(nextBlocks);
    setSelectedBlockId(newBlock.id);
    setSidebarTab('design');
  };

  const handleUpdateBlock = (nextBlock: Block) => {
    updateActiveBlocks(
      activeBlocks.map((b) => (b.id === nextBlock.id ? nextBlock : b)),
    );
  };

  const handleDeleteBlock = (blockId: string) => {
    const target = activeBlocks.find((b) => b.id === blockId);
    if (isHeroBlock(target)) {
      toast.error('Hero block cannot be removed');
      return;
    }
    updateActiveBlocks(activeBlocks.filter((b) => b.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const handleDuplicateBlock = (blockId: string) => {
    const index = activeBlocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    const target = activeBlocks[index];
    if (!target) return;
    if (isHeroBlock(target)) {
      toast.error('Hero cannot be duplicated');
      return;
    }
    const copy = { ...cloneBlock(target), id: crypto.randomUUID() };
    const next = [...activeBlocks];
    next.splice(index + 1, 0, copy);
    updateActiveBlocks(next);
    setSelectedBlockId(copy.id);
  };

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = activeBlocks.findIndex((b) => b.id === blockId);
    if (index === -1 || !canMoveBlock(activeBlocks, index, direction)) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    const next = [...activeBlocks];
    const [removed] = next.splice(index, 1);
    if (!removed) return;
    next.splice(nextIndex, 0, removed);
    updateActiveBlocks(next);
  };

  // ─── Page Operations ──────────────────────────────────────────────────────

  const handleCreateSite = async () => {
    const newPages: Record<string, PageBlocks> = {};
    selectedWizardPages.forEach((id) => {
      newPages[id] = getDefaultPageBlocks(id);
    });
    const sanitized = sanitizePages(newPages);
    const nextPageSettings = resolvePageSettingsMap(sanitized);
    setPages(sanitized);
    setSiteSettings({ ...DEFAULT_SITE_SETTINGS });
    setPageSettingsMap(nextPageSettings);
    setShowWizard(false);
    setActivePageId('home');
    setSelectedBlockId(null);
    await saveContent(
      sanitized,
      { ...DEFAULT_SITE_SETTINGS },
      nextPageSettings,
    );
  };

  const handleAddPage = (pageId: string, blocks?: PageBlocks) => {
    const normalized = normalizePageId(pageId);
    if (!normalized) {
      toast.error('Enter a page name');
      return;
    }
    if (pages[normalized]) {
      toast.error('Page already exists');
      return;
    }
    setPages((prev) => ({
      ...prev,
      [normalized]: sanitizePageBlocks(
        blocks ?? getDefaultPageBlocks(normalized),
      ),
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
      toast.error('Page already exists');
      return;
    }
    setPages((prev) => ({
      ...prev,
      [normalized]: [
        {
          type: 'text',
          id: crypto.randomUUID(),
          content: { text: 'Add your content...' },
        },
      ],
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
      toast.error('Home page is required');
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
    if (activePage === pageId) setActivePageId(remaining[0] ?? 'home');
  };

  const handleRenamePage = (pageId: string, nextLabel: string) => {
    const normalized = normalizePageId(nextLabel);
    if (!normalized || normalized === pageId) return;
    if (pages[normalized]) {
      toast.error('Page already exists');
      return;
    }
    setPages((prev) => {
      const next: Record<string, PageBlocks> = {};
      Object.entries(prev).forEach(([id, blocks]) => {
        next[id === pageId ? normalized : id] = blocks;
      });
      return next;
    });
    setPageSettingsMap((prev) => {
      const next: Record<string, PageSettings> = {};
      Object.entries(prev).forEach(([id, s]) => {
        next[id === pageId ? normalized : id] = s;
      });
      return next;
    });
    if (activePage === pageId) setActivePageId(normalized);
  };

  const handleUpdateSiteSettings = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => {
    setSiteSettings((prev) => ({ ...prev, [key]: value }));
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

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
          <span className="text-muted-foreground text-sm">Loading editor…</span>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="text-foreground flex h-[calc(100vh-64px)] flex-col bg-[#F5F5F5]">
      {/* ── Wizard ── */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="border-border bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Set up your website
            </DialogTitle>
            <DialogDescription>
              Choose which pages to include. You can add more later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {DEFAULT_PAGES.map((page) => (
              <label
                key={page.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  selectedWizardPages.includes(page.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                <Checkbox
                  checked={selectedWizardPages.includes(page.id)}
                  onCheckedChange={(checked) => {
                    if (checked)
                      setSelectedWizardPages([...selectedWizardPages, page.id]);
                    else
                      setSelectedWizardPages(
                        selectedWizardPages.filter((id) => id !== page.id),
                      );
                  }}
                  disabled={page.id === 'home'}
                />
                <span className="text-sm font-medium">{page.label}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSite} className="w-full">
              Create Website
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Page Manager ── */}
      <Dialog open={showPageManager} onOpenChange={setShowPageManager}>
        <DialogContent className="border-border bg-background sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Pages</DialogTitle>
            <DialogDescription>Add, rename, or remove pages.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                Current Pages
              </p>
              <div className="space-y-1.5">
                {pageIds.map((pageId) => (
                  <div
                    key={pageId}
                    className="border-border bg-muted/20 flex items-center gap-2 rounded-lg border p-2"
                  >
                    <Input
                      defaultValue={formatPageLabel(pageId)}
                      onBlur={(e) => handleRenamePage(pageId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                      }}
                      className="h-8 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() => {
                        setActivePageId(pageId);
                        setShowPageManager(false);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-8 text-xs"
                      onClick={() => handleRemovePage(pageId)}
                      disabled={pageId === 'home'}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                Add Template
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableTemplates.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    All templates added.
                  </p>
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
                      + {page.label}
                    </Button>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="Custom page name…"
                className="h-9 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomPage();
                }}
              />
              <Button size="sm" onClick={handleAddCustomPage}>
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPageManager(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Top Bar ── */}
      <TopBar
        projectName={project?.name}
        pageIds={pageIds}
        activePage={activePage}
        deviceMode={deviceMode}
        saving={saving}
        onPageClick={setActivePageId}
        onManagePages={() => setShowPageManager(true)}
        onDeviceChange={setDeviceMode}
        onPreview={() => window.open(`/site/${projectId}`, '_blank')}
        onSave={() => saveContent()}
        leftSidebarOpen={leftSidebarOpen}
        onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
      />

      {/* ── Editor Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        {leftSidebarOpen && (
          <LeftSidebar
            tab={sidebarTab}
            onTabChange={setSidebarTab}
            blocks={activeBlocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onAddBlock={handleAddBlock}
          />
        )}

        {/* Canvas */}
        <main
          className="flex flex-1 flex-col overflow-hidden"
          onClick={() => setSelectedBlockId(null)}
        >
          {/* Canvas toolbar */}
          <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-white px-5 py-2.5">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span className="text-foreground font-medium">
                {activePageLabel}
              </span>
              <span className="text-[#C8C8C8]">/</span>
              <span>
                {activeBlocks.length} section
                {activeBlocks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="bg-muted/60 text-muted-foreground rounded-md px-2 py-0.5 text-xs capitalize">
              {deviceMode}
            </span>
          </div>

          {/* Scrollable canvas */}
          <div
            className="flex-1 overflow-y-auto p-6"
            style={{ background: '#DCDCDC' }}
          >
            <div
              className="mx-auto transition-all duration-300"
              style={{ width: deviceWidth, maxWidth: '100%' }}
            >
              {/* Device chrome */}
              {deviceMode !== 'desktop' && (
                <div className="mb-2 flex items-center justify-center gap-2">
                  <div className="h-1 w-10 rounded-full bg-[#B0B0B0]" />
                </div>
              )}
              <div
                className="overflow-hidden bg-white"
                style={{
                  boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
                  minHeight: 520,
                  background: previewTheme.surface,
                  borderRadius: deviceMode !== 'desktop' ? 16 : 4,
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
                  <EmptyCanvas onAddBlock={() => setSidebarTab('blocks')} />
                ) : (
                  activeBlocks.map((block, index) => (
                    <BlockRenderer
                      key={block.id}
                      block={block}
                      selected={block.id === selectedBlockId}
                      canMoveUp={canMoveBlock(activeBlocks, index, 'up')}
                      canMoveDown={canMoveBlock(activeBlocks, index, 'down')}
                      onSelect={(e) => {
                        e.stopPropagation();
                        setSelectedBlockId(block.id);
                        setSidebarTab('design');
                      }}
                      onChange={handleUpdateBlock}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onDuplicate={() => handleDuplicateBlock(block.id)}
                      onMoveUp={() => handleMoveBlock(block.id, 'up')}
                      onMoveDown={() => handleMoveBlock(block.id, 'down')}
                      heroAlign={siteSettings.heroAlign}
                      theme={previewTheme}
                      sectionSpacingStyle={sectionSpacingStyle}
                    />
                  ))
                )}

                {/* Add section below */}
                {activeBlocks.length > 0 && (
                  <AddSectionButton onClick={() => setSidebarTab('blocks')} />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right Inspector */}
        <RightInspector
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
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({
  projectName,
  pageIds,
  activePage,
  deviceMode,
  saving,
  onPageClick,
  onManagePages,
  onDeviceChange,
  onPreview,
  onSave,
  leftSidebarOpen,
  onToggleLeftSidebar,
}: {
  projectName?: string;
  pageIds: string[];
  activePage: string;
  deviceMode: DeviceMode;
  saving: boolean;
  onPageClick: (id: string) => void;
  onManagePages: () => void;
  onDeviceChange: (mode: DeviceMode) => void;
  onPreview: () => void;
  onSave: () => void;
  leftSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
}) {
  return (
    <header className="z-20 flex h-14 items-center border-b border-[#E0E0E0] bg-white px-4">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLeftSidebar}
          className="text-muted-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg transition"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="bg-border h-5 w-px" />
        <div className="flex items-center gap-1.5">
          <Globe className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground text-sm font-semibold">
            {projectName ?? 'Website'}
          </span>
        </div>
      </div>

      {/* Center — page tabs */}
      <div className="flex flex-1 items-center justify-center gap-1 overflow-x-auto px-4">
        {pageIds.map((pageId) => (
          <button
            key={pageId}
            onClick={() => onPageClick(pageId)}
            className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              activePage === pageId
                ? 'text-foreground bg-[#F0F0F0] font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {formatPageLabel(pageId)}
          </button>
        ))}
        <button
          onClick={onManagePages}
          className="text-muted-foreground hover:bg-muted hover:text-foreground ml-1 flex h-7 w-7 items-center justify-center rounded-lg transition"
          title="Manage pages"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Device switcher */}
        <div className="border-border bg-muted/40 flex items-center rounded-lg border p-0.5">
          {(
            [
              ['desktop', Monitor],
              ['tablet', Tablet],
              ['mobile', Smartphone],
            ] as const
          ).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => onDeviceChange(mode)}
              className={`flex h-7 w-8 items-center justify-center rounded-md transition ${
                deviceMode === mode
                  ? 'text-foreground bg-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <div className="bg-border h-5 w-px" />
        <button
          onClick={onPreview}
          className="border-border bg-background text-muted-foreground hover:text-foreground flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
        <Button
          onClick={onSave}
          size="sm"
          disabled={saving}
          className="h-8 px-4 text-sm"
        >
          {saving ? 'Saving…' : 'Publish'}
        </Button>
      </div>
    </header>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar({
  tab,
  onTabChange,
  blocks,
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
}: {
  tab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  blocks: PageBlocks;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onAddBlock: (type: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[#E0E0E0] bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-[#E0E0E0]">
        {(['blocks', 'layers'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium capitalize transition ${
              tab === t
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'blocks' ? (
              <Plus className="h-3.5 w-3.5" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            {t === 'blocks' ? 'Add' : 'Layers'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'blocks' && (
          <div className="space-y-5 p-3">
            {BLOCK_LIBRARY.map((category) => (
              <div key={category.category}>
                <p className="text-muted-foreground mb-2 px-1 text-[10px] font-semibold tracking-widest uppercase">
                  {category.category}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        onClick={() => onAddBlock(item.type)}
                        className="group hover:border-primary/30 hover:bg-primary/5 flex flex-col items-center gap-1.5 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3 text-center transition hover:shadow-sm"
                      >
                        <div className="group-hover:ring-primary/30 flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition">
                          <Icon className="text-muted-foreground group-hover:text-primary h-4 w-4" />
                        </div>
                        <span className="text-foreground text-[11px] leading-tight font-medium">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'layers' && (
          <div className="p-2">
            {blocks.length === 0 ? (
              <div className="text-muted-foreground p-4 text-center text-xs">
                No sections yet. Add blocks to get started.
              </div>
            ) : (
              <div className="space-y-0.5">
                {blocks.map((block) => {
                  const Icon = getBlockIcon(block.type);
                  return (
                    <button
                      key={block.id}
                      onClick={() => onSelectBlock(block.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                        selectedBlockId === block.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 truncate text-xs font-medium capitalize">
                        {getBlockLabel(block.type)}
                      </span>
                      {isHeroBlock(block) && (
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold tracking-wide text-amber-700 uppercase">
                          Hero
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Right Inspector ──────────────────────────────────────────────────────────

function RightInspector({
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
  onUpdate: (b: Block) => void;
  onUpdateSiteSettings: <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => void;
  onUpdatePageSettings: <K extends keyof PageSettings>(
    key: K,
    value: PageSettings[K],
  ) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-[#E0E0E0] bg-white">
      <div className="border-b border-[#E0E0E0] px-4 py-3">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          Inspector
        </p>
        <p className="text-foreground mt-0.5 text-sm font-semibold">
          {block ? `${getBlockLabel(block.type)} Block` : 'Page Settings'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {block ? (
          <BlockInspector
            block={block}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        ) : (
          <PageInspector
            pageLabel={pageLabel}
            blockCount={blockCount}
            siteSettings={siteSettings}
            pageSettings={pageSettings}
            onUpdateSiteSettings={onUpdateSiteSettings}
            onUpdatePageSettings={onUpdatePageSettings}
          />
        )}
      </div>
    </aside>
  );
}

function BlockInspector({
  block,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  block: Block;
  onUpdate: (b: Block) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const Icon = getBlockIcon(block.type);
  return (
    <div className="divide-y divide-[#F0F0F0]">
      {/* Block info */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
            <Icon className="text-muted-foreground h-4 w-4" />
          </div>
          <div>
            <p className="text-foreground text-sm font-medium capitalize">
              {getBlockLabel(block.type)}
            </p>
            <p className="text-muted-foreground font-mono text-[10px]">
              {block.id.slice(0, 8)}…
            </p>
          </div>
        </div>

        {isHeroBlock(block) && (
          <p className="text-muted-foreground mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            Hero is pinned to the top and cannot be moved or deleted.
          </p>
        )}
      </div>

      {/* Controls */}
      {!isHeroBlock(block) && (
        <div className="px-4 py-3">
          <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
            Controls
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <InspectorActionButton
              icon={ArrowUp}
              label="Move up"
              onClick={onMoveUp}
              disabled={!onMoveUp}
            />
            <InspectorActionButton
              icon={ArrowDown}
              label="Move down"
              onClick={onMoveDown}
              disabled={!onMoveDown}
            />
            <InspectorActionButton
              icon={Copy}
              label="Duplicate"
              onClick={onDuplicate}
              disabled={!onDuplicate}
            />
            <InspectorActionButton
              icon={Trash2}
              label="Delete"
              onClick={onDelete}
              disabled={!onDelete}
              danger
            />
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="px-4 py-3">
        <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-widest uppercase">
          Settings
        </p>
        <BlockSettings block={block} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function PageInspector({
  pageLabel,
  blockCount,
  siteSettings,
  pageSettings,
  onUpdateSiteSettings,
  onUpdatePageSettings,
}: {
  pageLabel: string;
  blockCount: number;
  siteSettings: SiteSettings;
  pageSettings: PageSettings;
  onUpdateSiteSettings: <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => void;
  onUpdatePageSettings: <K extends keyof PageSettings>(
    key: K,
    value: PageSettings[K],
  ) => void;
}) {
  return (
    <div className="divide-y divide-[#F0F0F0]">
      <div className="px-4 py-4">
        <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
          Page
        </p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{pageLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sections</span>
            <span className="font-medium">{blockCount}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          Site Style
        </p>
        <AccentPickerField
          label="Accent color"
          value={siteSettings.accent}
          onChange={(v) => onUpdateSiteSettings('accent', v)}
        />
        <ChoiceField
          label="Surface"
          value={siteSettings.surface}
          options={SITE_SURFACE_OPTIONS}
          onChange={(v) => onUpdateSiteSettings('surface', v)}
        />
        <ChoiceField
          label="Corner style"
          value={siteSettings.radius}
          options={SITE_RADIUS_OPTIONS}
          onChange={(v) => onUpdateSiteSettings('radius', v)}
        />
        <ChoiceField
          label="Hero align"
          value={siteSettings.heroAlign}
          options={HERO_ALIGN_OPTIONS}
          onChange={(v) => onUpdateSiteSettings('heroAlign', v)}
        />
      </div>

      <div className="space-y-4 px-4 py-4">
        <p className="text-muted-foreground text-[10px] font-semibold tracking-widest uppercase">
          Page Style
        </p>
        <ChoiceField
          label="Background"
          value={pageSettings.background}
          options={PAGE_BACKGROUND_OPTIONS}
          onChange={(v) => onUpdatePageSettings('background', v)}
        />
        <ChoiceField
          label="Spacing"
          value={pageSettings.spacing}
          options={PAGE_SPACING_OPTIONS}
          onChange={(v) => onUpdatePageSettings('spacing', v)}
        />
        <ToggleField
          label="Show page header"
          checked={pageSettings.showPageHeader}
          onChange={(v) => onUpdatePageSettings('showPageHeader', v)}
        />
        <TextAreaField
          label="Page intro"
          value={pageSettings.intro}
          rows={3}
          placeholder="Optional intro text…"
          onChange={(v) => onUpdatePageSettings('intro', v)}
        />
      </div>
    </div>
  );
}

function InspectorActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition ${
        disabled
          ? 'border-border bg-muted/30 text-muted-foreground/40 cursor-not-allowed'
          : danger
            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
            : 'border-border bg-background text-foreground hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── Canvas Components ────────────────────────────────────────────────────────

function EmptyCanvas({ onAddBlock }: { onAddBlock: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#DCDCDC]">
        <Plus className="h-6 w-6 text-[#BABABA]" />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-800">This page is empty</p>
        <p className="mt-1 text-sm text-slate-500">
          Add your first block from the sidebar
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAddBlock();
        }}
        className="border-border text-foreground rounded-xl border bg-white px-5 py-2 text-sm font-medium shadow-sm transition hover:shadow-md"
      >
        + Add a block
      </button>
    </div>
  );
}

function AddSectionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="group flex w-full items-center justify-center gap-2 border-t border-dashed border-[#DCDCDC] py-4 text-sm text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
    >
      <Plus className="h-4 w-4" />
      Add section
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
  theme: ReturnType<typeof getSiteTheme>;
}) {
  return (
    <div
      className="border-b px-8 py-10"
      style={{
        background: `linear-gradient(135deg, ${theme.accentMuted}, rgba(255,255,255,0.96))`,
        borderColor: theme.border,
      }}
    >
      <span
        className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase"
        style={{ background: theme.accentSoft, color: theme.accentText }}
      >
        {pageLabel}
      </span>
      <h2 className="text-2xl font-semibold text-slate-900">{pageLabel}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
        {intro ||
          'Add a page intro in the inspector to give this page context.'}
      </p>
    </div>
  );
}

// ─── Block Renderer ───────────────────────────────────────────────────────────

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
  onSelect: (e: React.MouseEvent) => void;
  onChange: (b: Block) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  heroAlign: SiteSettings['heroAlign'];
  theme: ReturnType<typeof getSiteTheme>;
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

  return (
    <div
      className={`group relative cursor-pointer transition-all ${
        selected
          ? 'ring-2 ring-blue-400 ring-inset'
          : 'hover:ring-2 hover:ring-slate-200 hover:ring-inset'
      }`}
      onClick={onSelect}
    >
      {/* Floating toolbar */}
      <div
        className={`absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-white/60 bg-white/95 p-1 shadow-lg backdrop-blur-sm transition-all ${
          selected
            ? 'translate-y-0 opacity-100'
            : '-translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
        }`}
      >
        <BlockToolbarLabel type={block.type} />
        {!isHeroBlock(block) && (
          <>
            <ToolbarBtn
              label="Move up"
              onClick={onMoveUp}
              disabled={!canMoveUp}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn
              label="Move down"
              onClick={onMoveDown}
              disabled={!canMoveDown}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn label="Duplicate" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <div className="bg-border mx-0.5 h-4 w-px" />
            <ToolbarBtn
              label="Delete"
              onClick={onDelete}
              className="text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
          </>
        )}
      </div>

      {/* ── Hero ── */}
      {block.type === 'hero' && (
        <div
          className={`px-10 ${heroAlign === 'left' ? 'text-left' : 'text-center'}`}
          style={{
            ...sectionSpacingStyle,
            background: `linear-gradient(135deg, ${theme.accentMuted}, rgba(255,255,255,0.98))`,
          }}
        >
          <div
            className={heroAlign === 'left' ? 'max-w-3xl' : 'mx-auto max-w-3xl'}
          >
            <div
              className="mb-4 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase"
              style={{ background: theme.accentSoft, color: theme.accentText }}
            >
              Welcome
            </div>
            <input
              value={content.title ?? ''}
              onChange={(e) =>
                onChange({
                  ...block,
                  content: { ...content, title: e.target.value },
                })
              }
              className="mb-3 block w-full bg-transparent text-4xl font-bold text-slate-900 outline-none placeholder:text-slate-400 md:text-5xl"
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
              className="block w-full bg-transparent text-lg text-slate-500 outline-none placeholder:text-slate-400"
              placeholder="Subtitle"
            />
            <div
              className={`mt-8 flex flex-wrap gap-3 ${heroAlign === 'left' ? '' : 'justify-center'}`}
            >
              <span
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: theme.accent }}
              >
                Primary action
              </span>
              <span
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold text-slate-700"
                style={cardStyle}
              >
                Secondary
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Text ── */}
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
            className="min-h-[140px] w-full resize-none bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Write your content…"
          />
        </div>
      )}

      {/* ── Features ── */}
      {block.type === 'features' && (
        <div
          className="grid gap-4 px-8 md:grid-cols-3"
          style={sectionSpacingStyle}
        >
          {featureItems.map((item: string, i: number) => (
            <div
              key={i}
              className="rounded-xl border p-5 shadow-sm"
              style={cardStyle}
            >
              <div
                className="mb-3 h-8 w-8 rounded-lg"
                style={{ background: theme.accentSoft }}
              />
              <input
                value={item}
                onChange={(e) => {
                  const next = [...featureItems];
                  next[i] = e.target.value;
                  onChange({ ...block, content: { ...content, items: next } });
                }}
                className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                placeholder={`Feature ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Announcements ── */}
      {block.type === 'announcements' && (
        <DataBlock
          title="Announcements"
          hint="Live data from your club"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: Math.min(settings.limit ?? 3, 3) }).map(
              (_, i) => (
                <SkeletonCard key={i} theme={theme} cardStyle={cardStyle}>
                  <SkeletonLine w="60%" h={14} />
                  <SkeletonLine w="80%" h={11} className="mt-2" />
                  <SkeletonLine w="40%" h={11} className="mt-1" />
                </SkeletonCard>
              ),
            )}
          </div>
        </DataBlock>
      )}

      {/* ── Events ── */}
      {block.type === 'events' && (
        <DataBlock
          title="Events"
          hint="Upcoming events feed"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="space-y-2">
            {Array.from({ length: Math.min(settings.limit ?? 4, 4) }).map(
              (_, i) => (
                <SkeletonCard key={i} theme={theme} cardStyle={cardStyle} row>
                  <div className="flex-1 space-y-1">
                    <SkeletonLine w="50%" h={13} />
                    <SkeletonLine w="35%" h={11} />
                  </div>
                  {settings.showRsvp && (
                    <div
                      className="h-8 w-20 rounded-lg"
                      style={{ background: theme.accentSoft }}
                    />
                  )}
                </SkeletonCard>
              ),
            )}
          </div>
        </DataBlock>
      )}

      {/* ── Members ── */}
      {block.type === 'members' && (
        <DataBlock
          title="Members"
          hint="Public roster"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {Array.from({ length: Math.min(settings.limit ?? 6, 8) }).map(
              (_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-xl border p-4"
                  style={cardStyle}
                >
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ background: theme.accentSoft }}
                  />
                  <SkeletonLine w="70%" h={10} />
                </div>
              ),
            )}
          </div>
        </DataBlock>
      )}

      {/* ── Polls ── */}
      {block.type === 'polls' && (
        <DataBlock
          title="Polls & Voting"
          hint="Live polls"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="space-y-3">
            {Array.from({ length: Math.min(settings.limit ?? 2, 3) }).map(
              (_, i) => (
                <SkeletonCard key={i} theme={theme} cardStyle={cardStyle}>
                  <SkeletonLine w="55%" h={13} />
                  <div className="mt-3 space-y-2">
                    {[70, 45, 30].map((pct, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <SkeletonLine w="30%" h={11} />
                        <div
                          className="flex-1 rounded-full"
                          style={{ height: 6, background: theme.border }}
                        >
                          <div
                            className="rounded-full"
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: theme.accentSoft,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SkeletonCard>
              ),
            )}
          </div>
        </DataBlock>
      )}

      {/* ── Attendance ── */}
      {block.type === 'attendance' && (
        <DataBlock
          title="Attendance"
          hint="Recent sessions"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="space-y-2">
            {Array.from({ length: Math.min(settings.limit ?? 3, 4) }).map(
              (_, i) => (
                <SkeletonCard key={i} theme={theme} cardStyle={cardStyle} row>
                  <SkeletonLine w="45%" h={13} />
                  {settings.showCounts && <SkeletonLine w="15%" h={11} />}
                </SkeletonCard>
              ),
            )}
          </div>
        </DataBlock>
      )}

      {/* ── Tasks ── */}
      {block.type === 'tasks' && (
        <DataBlock
          title="Tasks"
          hint="Open project tasks"
          theme={theme}
          sectionSpacingStyle={sectionSpacingStyle}
        >
          <div className="space-y-2">
            {Array.from({ length: Math.min(settings.limit ?? 5, 6) }).map(
              (_, i) => (
                <SkeletonCard key={i} theme={theme} cardStyle={cardStyle} row>
                  <div
                    className="h-4 w-4 rounded border"
                    style={{ borderColor: theme.border }}
                  />
                  <SkeletonLine w="55%" h={13} className="flex-1" />
                  {settings.showStatus && (
                    <div
                      className="h-5 w-16 rounded-full"
                      style={{ background: theme.accentSoft }}
                    />
                  )}
                </SkeletonCard>
              ),
            )}
          </div>
        </DataBlock>
      )}
    </div>
  );
}

// ─── Block Canvas Helpers ─────────────────────────────────────────────────────

function BlockToolbarLabel({ type }: { type: string }) {
  const Icon = getBlockIcon(type);
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-slate-600">
      <Icon className="h-3 w-3" />
      {getBlockLabel(type)}
    </div>
  );
}

function ToolbarBtn({
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
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
        disabled
          ? 'cursor-not-allowed opacity-30'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

function DataBlock({
  title,
  hint,
  theme,
  sectionSpacingStyle,
  children,
}: {
  title: string;
  hint?: string;
  theme: ReturnType<typeof getSiteTheme>;
  sectionSpacingStyle: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className="px-8"
      style={{ ...sectionSpacingStyle, background: theme.accentMuted }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: theme.accentText }}
          >
            {title}
          </p>
          {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </div>
        <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          Live data
        </span>
      </div>
      {children}
    </div>
  );
}

function SkeletonCard({
  theme,
  cardStyle,
  row,
  children,
}: {
  theme: ReturnType<typeof getSiteTheme>;
  cardStyle: CSSProperties;
  row?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${row ? 'flex items-center gap-4' : ''}`}
      style={cardStyle}
    >
      {children}
    </div>
  );
}

function SkeletonLine({
  w,
  h,
  className,
}: {
  w: string;
  h: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md bg-slate-200 ${className ?? ''}`}
      style={{ width: w, height: h }}
    />
  );
}

// ─── Inspector Field Components ───────────────────────────────────────────────

function BlockSettings({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (b: Block) => void;
}) {
  const settings = block.settings || {};

  if (block.type === 'announcements')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
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

  if (block.type === 'events')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
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

  if (block.type === 'members')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
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

  if (block.type === 'polls')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
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

  if (block.type === 'attendance')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
          value={settings.limit ?? 4}
          min={1}
          max={10}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Show attendance counts"
          checked={settings.showCounts ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, showCounts: v } })
          }
        />
      </div>
    );

  if (block.type === 'tasks')
    return (
      <div className="space-y-3">
        <NumberField
          label="Items to show"
          value={settings.limit ?? 6}
          min={1}
          max={20}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, limit: v } })
          }
        />
        <ToggleField
          label="Show status badge"
          checked={settings.showStatus ?? true}
          onChange={(v) =>
            onUpdate({ ...block, settings: { ...settings, showStatus: v } })
          }
        />
      </div>
    );

  return (
    <p className="border-border bg-muted/20 text-muted-foreground rounded-xl border border-dashed p-3 text-xs">
      Edit this block's content directly on the canvas.
    </p>
  );
}

function AccentPickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeAccentColor(value);
  const [hexInput, setHexInput] = useState(normalized);
  useEffect(() => {
    if (!open) setHexInput(normalized);
  }, [normalized, open]);

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-muted-foreground text-xs font-medium">
          {label}
        </label>
        <button
          onClick={() => setOpen(true)}
          className="border-border bg-background hover:border-primary/40 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 transition"
        >
          <span
            className="h-5 w-5 rounded-md border border-black/10 shadow-sm"
            style={{ background: normalized }}
          />
          <span className="text-foreground flex-1 text-left text-sm">
            {normalized}
          </span>
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accent Color</DialogTitle>
            <DialogDescription>
              Choose a preset or pick a custom color.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-3 gap-2">
              {SITE_ACCENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setHexInput(opt.color);
                    onChange(opt.color);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                    normalized === opt.color
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-md"
                    style={{ background: opt.color }}
                  />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={normalized}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  onChange(e.target.value);
                }}
                className="border-border h-10 w-12 cursor-pointer rounded-lg border p-1"
              />
              <Input
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="#4189e2"
                className="flex-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange(normalizeAccentColor(hexInput));
                setOpen(false);
              }}
            >
              Apply
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
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border py-2 text-xs font-medium transition ${
              value === opt.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:border-primary/30 hover:bg-muted'
            }`}
          >
            {opt.label}
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
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="border-border bg-background text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg border transition"
        >
          −
        </button>
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="flex-1 text-center"
        />
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="border-border bg-background text-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg border transition"
        >
          +
        </button>
      </div>
    </div>
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
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/20 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
      />
    </div>
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
    <label className="border-border bg-muted/20 flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
      <span className="text-foreground text-xs font-medium">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </div>
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
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background text-foreground w-full rounded-xl border px-3 py-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
