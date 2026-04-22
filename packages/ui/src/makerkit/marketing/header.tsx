import { cn } from '../../lib/utils';

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  logo?: React.ReactNode;
  navigation?: React.ReactNode;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = function ({
  className,
  logo,
  navigation,
  actions,
  ...props
}) {
  return (
    <div
      className={cn(
        'site-header bg-background/80 dark:bg-background/50 sticky top-0 z-10 w-full py-1 backdrop-blur-md',
        className,
      )}
      {...props}
    >
      <div className="container">
        <div className="flex h-14 items-center justify-between gap-x-4">
          <div>{logo}</div>
          <div className="flex flex-1 justify-center">{navigation}</div>
          <div className="flex items-center justify-end gap-x-2">{actions}</div>
        </div>
      </div>
    </div>
  );
};
