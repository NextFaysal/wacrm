import type { ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Section header shown at the top of settings panels.
 * Features crisp typography, optional category badge, back action for mobile,
 * and flexible right-aligned action trigger.
 */
export function SettingsPanelHead({
  title,
  description,
  action,
  badge,
  icon: Icon,
  onBack,
  backLabel = 'Back to Overview',
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  icon?: LucideIcon;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 space-y-3', className)}>
      {onBack ? (
        <div className="lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>{backLabel}</span>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {Icon ? (
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
            ) : null}
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>

          {description ? (
            <p className="mt-1.5 max-w-[68ch] text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>

        {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
      </div>
    </div>
  );
}
