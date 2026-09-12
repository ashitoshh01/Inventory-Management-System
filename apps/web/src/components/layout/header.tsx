import * as React from 'react';

import { cn } from '@repo/ui';

export function Header({ className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8',
        className,
      )}
    >
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />
          <div className="text-sm font-semibold leading-6 text-foreground">User Name</div>
        </div>
      </div>
    </header>
  );
}
