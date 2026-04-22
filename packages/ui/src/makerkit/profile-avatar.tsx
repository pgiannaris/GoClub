import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../shadcn/avatar';

type SessionProps = {
  displayName: string | null;
  pictureUrl?: string | null;
};

type TextProps = {
  text: string;
};

type ProfileAvatarProps = (SessionProps | TextProps) & {
  className?: string;
  fallbackClassName?: string;
};


export function ProfileAvatar(props: ProfileAvatarProps) {
  const avatarClassName = cn(props.className, 'mx-auto h-9 w-9');

  if ('text' in props) {
    return (
      <Avatar className={avatarClassName}>
        <AvatarFallback
          className={cn(
            props.fallbackClassName,
            'animate-in fade-in uppercase',
          )}
        >
          {props.text.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
    );
  }

  console.log('Rendering ProfileAvatar with displayName:', props.displayName);
  console.log('Picture URL:', props);

  return (
    <Avatar className={avatarClassName}>
      <AvatarImage
        src={props.pictureUrl ?? undefined}
        alt={props.displayName ?? 'User avatar'}
      />

      <AvatarFallback
        className={cn(props.fallbackClassName, 'animate-in fade-in uppercase')}
      >
        <span suppressHydrationWarning>{props.displayName?.slice(0, 1)}</span>
      </AvatarFallback>
    </Avatar>
  );
}
