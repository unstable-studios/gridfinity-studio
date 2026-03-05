import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'

import { cn } from '@/lib/utils'

function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'inline-flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden',
        className
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'px-3 py-1.5 text-xs font-medium transition text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 data-[state=on]:bg-zinc-200 dark:data-[state=on]:bg-zinc-700 data-[state=on]:text-zinc-900 dark:data-[state=on]:text-zinc-100 outline-none select-none',
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
