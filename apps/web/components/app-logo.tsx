import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@kit/ui/utils';

import closedLogo from './folder_logo_goclub.svg';
import openLogo from './folder3.png';

type AppLogoVariant = 'open' | 'closed';

function LogoImage({
  className,
  width = 90,
  variant = 'open',
}: {
  className?: string;
  width?: number;
  variant?: AppLogoVariant;
}) {
  const logo = variant === 'closed' ? openLogo : openLogo;
  const height = Math.round((width * logo.height) / logo.width);

  return (
    <Image
      src={logo}
      alt="GoClub Logo"
      width={width}
      height={height}
      className={cn('h-auto', className)}
      priority
    />
  );
}

export function AppLogo({
  href,
  label,
  className,
  width,
  variant = 'open',
}: {
  href?: string | null;
  className?: string;
  label?: string;
  width?: number;
  variant?: AppLogoVariant;
}) {
  if (href === null) {
    return <LogoImage className={className} width={width} variant={variant} />;
  }

  return (
    <Link aria-label={label ?? 'Home Page'} href={href ?? '/'}>
      <LogoImage className={className} width={width} variant={variant} />
    </Link>
  );
}
