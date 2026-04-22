'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Slot } from '@radix-ui/react-slot';
import { VariantProps, cva } from 'class-variance-authority';
import { ChevronDown, PanelLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '../hooks/use-mobile';
import { cn, isRouteActive } from '../lib/utils';
import { If } from '../makerkit/if';
import type { SidebarConfig } from '../makerkit/sidebar';
import { Trans } from '../makerkit/trans';
import { Button } from './button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import { Input } from './input';
import { Separator } from './separator';
import { Sheet, SheetContent } from './sheet';
import { Skeleton } from './skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '15rem';
const SIDEBAR_WIDTH_MOBILE = '20rem';
const SIDEBAR_WIDTH_ICON = '4.55rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';
const SIDEBAR_MINIMIZED_WIDTH = SIDEBAR_WIDTH_ICON;

type SidebarContext = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

export const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);

  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

const SidebarProvider: React.FC<
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
> = ({
  ref,
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const collapsibleStyle = process.env.NEXT_PUBLIC_SIDEBAR_COLLAPSIBLE_STYLE;

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      if (setOpenProp) {
        return setOpenProp?.(typeof value === 'function' ? value(open) : value);
      }

      _setOpen(value);

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  const sidebarWidth = !open
    ? collapsibleStyle === 'icon'
      ? SIDEBAR_WIDTH_ICON
      : collapsibleStyle === 'offcanvas'
        ? 0
        : SIDEBAR_MINIMIZED_WIDTH
    : SIDEBAR_WIDTH;

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          style={
            {
              '--sidebar-width': sidebarWidth,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          data-sidebar-visible={!isMobile}
          data-minimized={!open}
          className={cn(
            'group text-sidebar-foreground has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full',
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};

SidebarProvider.displayName = 'SidebarProvider';

const Sidebar: React.FC<
  React.ComponentPropsWithRef<'div'> & {
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset' | 'ghost';
    collapsible?: 'offcanvas' | 'icon' | 'none';
    lockOpen?: boolean;
    overlayDesktop?: boolean;
  }
> = ({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  lockOpen = false,
  overlayDesktop = false,
  className,
  children,
  ref,
  ...props
}) => {
  const { isMobile, state, open, setOpen, openMobile, setOpenMobile } =
    useSidebar();
  const sidebarDesktopRef = React.useRef<HTMLDivElement | null>(null);
  const hoverExpandedRef = React.useRef(false);
  const hoverOpenTimerRef = React.useRef<number | null>(null);
  const hoverCloseTimerRef = React.useRef<number | null>(null);

  const clearHoverTimers = React.useCallback(() => {
    if (hoverOpenTimerRef.current !== null) {
      window.clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }

    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearHoverTimers();
    };
  }, [clearHoverTimers]);

  React.useEffect(() => {
    if (collapsible === 'none' || isMobile || !lockOpen) return;

    clearHoverTimers();

    if (!open) {
      hoverExpandedRef.current = true;
      setOpen(true);
    }
  }, [clearHoverTimers, collapsible, isMobile, lockOpen, open, setOpen]);

  React.useEffect(() => {
    if (collapsible === 'none' || isMobile || !overlayDesktop || !open || lockOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (!target) return;
      if (target.closest('[data-sidebar="trigger"]')) return;
      if (sidebarDesktopRef.current?.contains(target)) return;

      clearHoverTimers();
      hoverExpandedRef.current = false;
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [clearHoverTimers, collapsible, isMobile, lockOpen, open, overlayDesktop, setOpen]);

  const setSidebarRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      sidebarDesktopRef.current = node;

      if (!ref) return;

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      ref.current = node;
    },
    [ref],
  );

  if (collapsible === 'none') {
    return (
      <div
        className={cn(
          'bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col',
          className,
          {
            [SIDEBAR_MINIMIZED_WIDTH]: !open,
          },
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-mobile="true"
          className={cn(
            'text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden',
            {
              'bg-background': variant === 'ghost',
              'bg-sidebar': variant !== 'ghost',
            },
          )}
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  const handleMouseEnter = () => {
    if (collapsible !== 'icon' || isMobile) return;
    clearHoverTimers();

    if (!open) {
      hoverOpenTimerRef.current = window.setTimeout(() => {
        hoverExpandedRef.current = true;
        setOpen(true);
      }, 70);
    }
  };

  const handleMouseLeave = () => {
    if (collapsible !== 'icon' || isMobile || lockOpen) return;
    clearHoverTimers();

    if (open) {
      hoverCloseTimerRef.current = window.setTimeout(() => {
        hoverExpandedRef.current = false;
        setOpen(false);
      }, 130);
    }
  };

  return (
    <div
      ref={setSidebarRef}
      className="group peer hidden md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {!overlayDesktop ? (
        <div
          className={cn(
          'relative w-(--sidebar-width) bg-transparent transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none',
            'group-data-[collapsible=offcanvas]:w-0',
            'group-data-[side=right]:rotate-180',
            variant === 'floating' || variant === 'inset'
              ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
              : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
            {
              'h-svh': variant !== 'ghost',
            },
          )}
        />
      ) : null}
     {/*"This is the CSS for the navbar"*/}
      <div
        className={cn(
          'fixed inset-y-0 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none md:flex',
          overlayDesktop ? 'z-40' : 'z-10',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
          // Adjust the padding for floating and inset variants.
          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          className={cn(
            'bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm',
            {
              'bg-transparent': variant === 'ghost',
            },
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

Sidebar.displayName = 'Sidebar';

const SidebarTrigger: React.FC<React.ComponentProps<typeof Button>> = ({
  className,
  onClick,
  ...props
}) => {
  const context = React.useContext(SidebarContext);

  if (!context) {
    return null;
  }

  const { toggleSidebar } = context;

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};
SidebarTrigger.displayName = 'SidebarTrigger';

const SidebarRail: React.FC<React.ComponentProps<'button'>> = ({
  className,
  ...props
}) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
        'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
        '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
        'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarRail.displayName = 'SidebarRail';

const SidebarInset: React.FC<React.ComponentProps<'main'>> = ({
  className,
  ...props
}) => {
  return (
    <main
      className={cn(
        'bg-background relative flex min-h-svh flex-1 flex-col',
        'peer-data-[variant=inset]:min-h-[calc(100svh-(--spacing(4)))] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarInset.displayName = 'SidebarInset';

const SidebarInput: React.FC<React.ComponentPropsWithRef<typeof Input>> = ({
  className,
  ...props
}) => {
  return (
    <Input
      data-sidebar="input"
      className={cn(
        'bg-background focus-visible:ring-sidebar-ring h-8 w-full shadow-none focus-visible:ring-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarInput.displayName = 'SidebarInput';

const SidebarHeader: React.FC<React.ComponentPropsWithRef<'div'>> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-sidebar="header"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
};
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter: React.FC<React.ComponentProps<'div'>> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-sidebar="footer"
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
};
SidebarFooter.displayName = 'SidebarFooter';

const SidebarSeparator: React.FC<React.ComponentProps<typeof Separator>> = ({
  className,
  ...props
}) => {
  return (
    <Separator
      data-sidebar="separator"
      className={cn('bg-sidebar-border mx-2 w-auto', className)}
      {...props}
    />
  );
};
SidebarSeparator.displayName = 'SidebarSeparator';

const SidebarContent: React.FC<React.ComponentProps<'div'>> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
};
SidebarContent.displayName = 'SidebarContent';

const SidebarGroup: React.FC<React.ComponentProps<'div'>> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-sidebar="group"
      className={cn(
        'relative flex w-full min-w-0 flex-col p-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarGroup.displayName = 'SidebarGroup';

const SidebarGroupLabel: React.FC<
  React.ComponentProps<'div'> & { asChild?: boolean }
> = ({ className, asChild = false, ...props }) => {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-sidebar="group-label"
      className={cn(
        'text-muted-foreground ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        'group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

const SidebarGroupAction: React.FC<
  React.ComponentProps<'button'> & { asChild?: boolean }
> = ({ className, asChild = false, ...props }) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-sidebar="group-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupAction.displayName = 'SidebarGroupAction';

const SidebarGroupContent: React.FC<React.ComponentProps<'div'>> = ({
  className,
  ...props
}) => (
  <div
    data-sidebar="group-content"
    className={cn('w-full text-sm', className)}
    {...props}
  />
);
SidebarGroupContent.displayName = 'SidebarGroupContent';

const SidebarMenu: React.FC<React.ComponentProps<'ul'>> = ({
  className,
  ...props
}) => (
  <ul
    data-sidebar="menu"
    className={cn(
      'flex w-full min-w-0 flex-col gap-1',
      className,
    )}
    {...props}
  />
);
SidebarMenu.displayName = 'SidebarMenu';

const SidebarMenuItem: React.FC<React.ComponentProps<'li'>> = ({
  className,
  ...props
}) => (
  <li
    data-sidebar="menu-item"
    className={cn(
      'group/menu-item relative',
      className,
    )}
    {...props}
  />
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

const sidebarMenuButtonVariants = cva(
  'peer/menu-button text-sidebar-foreground active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent/90 data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-semibold data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.55)] dark:hover:bg-sidebar-accent/40 dark:data-[active=true]:bg-sidebar-accent data-[state=open]:hover:bg-sidebar-accent/55 data-[state=open]:hover:text-sidebar-accent-foreground flex w-full items-center overflow-hidden rounded-sm p-3 pl-2 text-left text-sm outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 transition-[width,height,padding,background-color,color,box-shadow] duration-350 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none group-has-data-[sidebar=menu-action]/menu-item:pr-8 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0 data-[active=true]:[&_[data-sidebar=menu-icon]]:bg-sidebar-accent data-[active=true]:[&_[data-sidebar=menu-icon]]:text-sidebar-accent-foreground data-[active=true]:[&_[data-sidebar=menu-icon]]:ring-1 data-[active=true]:[&_[data-sidebar=menu-icon]]:ring-sidebar-border/70',
  {
    variants: {
      variant: {
        default: 'hover:text-sidebar-accent-foreground',
        outline:
          'bg-background hover:text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-10 text-sm',
        sm: 'h-8 text-xs',
        lg: 'h-14 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const SidebarMenuButton: React.FC<
  React.ComponentProps<'button'> & {
    asChild?: boolean;
    isActive?: boolean;
    tooltip?: string | React.ComponentProps<typeof TooltipContent>;
  } & VariantProps<typeof sidebarMenuButtonVariants>
> = ({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}) => {
  const Comp = asChild ? Slot : 'button';
  const { isMobile, open } = useSidebar();
  const { t } = useTranslation();

  const button = (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  if (typeof tooltip === 'string') {
    tooltip = {
      children: t(tooltip, {
        defaultValue: tooltip,
      }),
    };
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={isMobile || open}
        {...tooltip}
      />
    </Tooltip>
  );
};

SidebarMenuButton.displayName = 'SidebarMenuButton';

const SidebarMenuAction: React.FC<
  React.ComponentProps<'button'> & {
    asChild?: boolean;
    showOnHover?: boolean;
  }
> = ({ className, asChild = false, showOnHover = false, ...props }) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-sidebar="menu-action"
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.55)] dark:hover:bg-sidebar-accent/45 peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-6 items-center justify-center rounded-md p-0 outline-hidden transition-[transform,opacity,background-color,color,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none focus-visible:ring-2 [&>svg]:size-5 [&>svg]:shrink-0',
        // Increases the hit area of the button on mobile.
        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuAction.displayName = 'SidebarMenuAction';

const SidebarMenuBadge: React.FC<React.ComponentProps<'div'>> = ({
  className,
  ...props
}) => (
  <div
    data-sidebar="menu-badge"
    className={cn(
      'text-sidebar-foreground pointer-events-none absolute right-1 flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none',
      'peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground',
      'peer-data-[size=sm]/menu-button:top-1',
      'peer-data-[size=default]/menu-button:top-1.5',
      'peer-data-[size=lg]/menu-button:top-2.5',
      'group-data-[collapsible=icon]:hidden',
      className,
    )}
    {...props}
  />
);
SidebarMenuBadge.displayName = 'SidebarMenuBadge';

const SidebarMenuSkeleton: React.FC<
  React.ComponentProps<'div'> & {
    showIcon?: boolean;
  }
> = ({ className, showIcon = false, ...props }) => {
  // Keep SSR and hydration deterministic.
  const width = '72%';

  return (
    <div
      data-sidebar="menu-skeleton"
      className={cn('flex h-10 items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-5 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-5 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            '--skeleton-width': width,
          } as React.CSSProperties
        }
      />
    </div>
  );
};
SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton';

const SidebarMenuSub: React.FC<React.ComponentProps<'ul'>> = ({
  className,
  ...props
}) => (
  <ul
    data-sidebar="menu-sub"
    className={cn(
      'border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5',
      className,
    )}
    {...props}
  />
);
SidebarMenuSub.displayName = 'SidebarMenuSub';

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ ...props }, ref) => <li ref={ref} {...props} />);
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem';

const SidebarMenuSubButton: React.FC<
  React.ComponentProps<'a'> & {
    asChild?: boolean;
    size?: 'sm' | 'md';
    isActive?: boolean;
  }
> = ({ asChild = false, size = 'md', isActive, className, ...props }) => {
  const Comp = asChild ? Slot : 'a';

  return (
    <Comp
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border)/0.55)] active:bg-sidebar-accent/90 active:text-sidebar-accent-foreground dark:hover:bg-sidebar-accent/45 [&>svg]:text-sidebar-accent-foreground flex h-8 min-w-0 -translate-x-px items-center overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-5 [&>svg]:shrink-0',
        'data-[active=true]:bg-sidebar-accent/90 data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium data-[active=true]:shadow-[inset_0_0_0_1px_hsl(var(--sidebar-border))] dark:data-[active=true]:bg-sidebar-accent',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton';

export function SidebarNavigation({
  config,
}: React.PropsWithChildren<{
  config: SidebarConfig;
}>) {
  const currentPath = usePathname() ?? '';
  const { open } = useSidebar();
  const hiddenGroupLabels = new Set([
    'common:routes.application',
    'common:routes.settings',
  ]);
  const iconWrapperClassName =
    'mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm transition-[color,background-color] duration-300 ease-in-out';

  const labelClassName = cn(
    'min-w-fit flex-1 whitespace-nowrap transition-[opacity,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
    {
      'opacity-100 pointer-events-none': !open,
      'opacity-100 translate-x-0': open,
    },
  );

  return (
    <>
      {config.routes.map((item, index) => {
        const isLast = index === config.routes.length - 1;

        if ('divider' in item) {
          return (
            <SidebarSeparator
              key={`divider-${index}`}
              className="shrink-0 h-[1px] bg-sidebar-border mx-2 w-auto transition-opacity duration-300"
            />
          );
        }

      if ('children' in item) {
        const hasLabel =
          typeof item.label === 'string' ? item.label.trim().length > 0 : true;
        const shouldShowGroupLabel =
          hasLabel && !hiddenGroupLabels.has(item.label);
        const Container = (props: React.PropsWithChildren) => {
          if (item.collapsible) {
            return (
                <Collapsible
                  defaultOpen={!item.collapsed}
                  className={'group/collapsible'}
                >
                  {props.children}
                </Collapsible>
              );
            }

            return props.children;
          };

          const ContentContainer = (props: React.PropsWithChildren) => {
            if (item.collapsible) {
              return <CollapsibleContent>{props.children}</CollapsibleContent>;
            }

            return props.children;
          };

          return (
            <Container key={`collapsible-${index}`}>
              <SidebarGroup key={item.label}>
                {shouldShowGroupLabel ? (
                  <If
                    condition={item.collapsible}
                    fallback={
                      <SidebarGroupLabel>
                        <span className={labelClassName}>
                          <Trans i18nKey={item.label} defaults={item.label} />
                        </span>
                      </SidebarGroupLabel>
                    }
                  >
                    <SidebarGroupLabel asChild>
                      <CollapsibleTrigger>
                        <span className={labelClassName}>
                          <Trans i18nKey={item.label} defaults={item.label} />
                        </span>
                        <ChevronDown
                          className={cn(
                            'ml-auto size-4 transition-[transform,opacity] duration-300 group-data-[state=open]/collapsible:rotate-180',
                            {
                              'opacity-0': !open,
                            },
                          )}
                        />
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                  </If>
                ) : null}

                <If condition={item.renderAction}>
                  <SidebarGroupAction title={item.label}>
                    {item.renderAction}
                  </SidebarGroupAction>
                </If>

                <SidebarGroupContent>
                  <SidebarMenu>
                    <ContentContainer>
                      {item.children.map((child, childIndex) => {
                        const suppressIconBackground =
                          'path' in child &&
                          child.path === '/home' &&
                          child.label === 'All Projects';

                        const Container = (props: React.PropsWithChildren) => {
                          if ('collapsible' in child && child.collapsible) {
                            return (
                              <Collapsible
                                defaultOpen={!child.collapsed}
                                className={'group/collapsible'}
                              >
                                {props.children}
                              </Collapsible>
                            );
                          }

                          return props.children;
                        };

                        const ContentContainer = (
                          props: React.PropsWithChildren,
                        ) => {
                          if ('collapsible' in child && child.collapsible) {
                            return (
                              <CollapsibleContent>
                                {props.children}
                              </CollapsibleContent>
                            );
                          }

                          return props.children;
                        };

                        const TriggerItem = () => {
                          if ('collapsible' in child && child.collapsible) {
                            return (
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton tooltip={child.label}>
                                  <div className="flex items-center">
                                    <span
                                      data-sidebar="menu-icon"
                                      className={iconWrapperClassName}
                                    >
                                      {child.Icon}
                                    </span>
                                    <span className={labelClassName}>
                                      <Trans
                                        i18nKey={child.label}
                                        defaults={child.label}
                                      />
                                    </span>

                                    <ChevronDown
                                      className={cn(
                                        'ml-auto size-4 transition-[transform,opacity] duration-300 group-data-[state=open]/collapsible:rotate-180',
                                        {
                                          'opacity-0': !open,
                                        },
                                      )}
                                    />
                                  </div>
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                            );
                          }

                          const path = 'path' in child ? child.path : '';
                          const end = 'end' in child ? child.end : false;

                          const isActive = isRouteActive(
                            path,
                            currentPath,
                            end,
                          );

                          return (
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={child.label}
                              data-no-icon-bg={
                                suppressIconBackground ? 'true' : undefined
                              }
                            >
                              <Link className="flex items-center" href={path}>
                                <span
                                  data-sidebar="menu-icon"
                                  className={iconWrapperClassName}
                                >
                                  {child.Icon}
                                </span>
                                <span className={labelClassName}>
                                  <Trans
                                    i18nKey={child.label}
                                    defaults={child.label}
                                  />
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          );
                        };

                        return (
                          <Container key={`group-${index}-${childIndex}`}>
                            <SidebarMenuItem>
                              <TriggerItem />

                              <ContentContainer>
                                <If condition={child.children}>
                                  {(children) => (
                                    <SidebarMenuSub
                                    >
                                      {children.map((child) => {
                                        const isActive = isRouteActive(
                                          child.path,
                                          currentPath,
                                          child.end,
                                        );

                                        const linkClassName = 'flex items-center';
                                        const spanClassName = labelClassName;

                                        return (
                                          <SidebarMenuSubItem key={child.path}>
                                            <SidebarMenuSubButton
                                              isActive={isActive}
                                              asChild
                                            >
                                              <Link
                                                className={linkClassName}
                                                href={child.path}
                                              >
                                                <span
                                                  data-sidebar="menu-icon"
                                                  className={iconWrapperClassName}
                                                >
                                                  {child.Icon}
                                                </span>

                                                <span className={spanClassName}>
                                                  <Trans
                                                    i18nKey={child.label}
                                                    defaults={child.label}
                                                  />
                                                </span>
                                              </Link>
                                            </SidebarMenuSubButton>
                                          </SidebarMenuSubItem>
                                        );
                                      })}
                                    </SidebarMenuSub>
                                  )}
                                </If>
                              </ContentContainer>

                              {child.renderAction ? (
                                <SidebarMenuAction>
                                  {child.renderAction}
                                </SidebarMenuAction>
                              ) : null}
                            </SidebarMenuItem>
                          </Container>
                        );
                      })}
                    </ContentContainer>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {!isLast ? (
                <SidebarSeparator
                  className="transition-opacity duration-300"
                />
              ) : null}
            </Container>
          );
        }
      })}
    </>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
