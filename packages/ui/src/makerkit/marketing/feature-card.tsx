import React from 'react';

import { cn } from '../../lib/utils';
import { CardDescription, CardHeader, CardTitle } from '../../shadcn/card';

interface FeatureCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  description: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  className,
  label,
  description,
  ...props
}) => {
  return (
    <div className={cn('rounded-xl border p-4', className)} {...props}>
      <CardHeader className="items-center text-center">
        <CardTitle className="text-xl font-medium text-center">{label}</CardTitle>

        <CardDescription className="text-muted-foreground mx-auto max-w-xs text-center text-sm font-normal">
          {description}
        </CardDescription>
      </CardHeader>
    </div>
  );
};
