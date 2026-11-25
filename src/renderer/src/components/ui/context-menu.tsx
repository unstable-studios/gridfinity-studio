import * as React from 'react'
import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
}

function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={cn(
          'bg-white text-zinc-950 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 p-1 shadow-md dark:bg-zinc-950 dark:text-zinc-50 dark:border-zinc-800',
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
  variant?: 'default' | 'destructive'
}) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "focus:bg-zinc-100 focus:text-zinc-900 data-[variant=destructive]:text-red-500 data-[variant=destructive]:focus:bg-red-500/10 relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 dark:focus:bg-zinc-800 dark:focus:text-zinc-50 dark:data-[variant=destructive]:text-red-400 dark:data-[variant=destructive]:focus:bg-red-500/20",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn('bg-zinc-200 -mx-1 my-1 h-px dark:bg-zinc-800', className)}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        'focus:bg-zinc-100 focus:text-zinc-900 relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-zinc-800 dark:focus:text-zinc-50',
        className
      )}
      {...props}
    >
      {children}
      <span className="pointer-events-none absolute right-2 flex size-3.5 items-center justify-center">
        <ContextMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </ContextMenuPrimitive.ItemIndicator>
      </span>
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuSub({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />
}

function ContextMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger>) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(
        'focus:bg-zinc-100 focus:text-zinc-900 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900 flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none dark:focus:bg-zinc-800 dark:focus:text-zinc-50 dark:data-[state=open]:bg-zinc-800 dark:data-[state=open]:text-zinc-50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </ContextMenuPrimitive.SubTrigger>
  )
}

function ContextMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        data-slot="context-menu-sub-content"
        className={cn(
          'bg-white text-zinc-950 z-50 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 p-1 shadow-lg dark:bg-zinc-950 dark:text-zinc-50 dark:border-zinc-800',
          className
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent
}
