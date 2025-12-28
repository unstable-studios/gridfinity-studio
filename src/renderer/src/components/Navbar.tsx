import Logo from './Logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

export default function Navbar(): React.JSX.Element {
  return (
    <div className="h-16 w-full border-b gap-4 border-zinc-300 flex items-center justify-between px-4 shadow-sm bg-white dark:bg-zinc-800 dark:border-zinc-700">
      <Logo />
      <div className="flex items-center gap-2">
        <FileMenu />
        <EditMenu />
        <HelpMenu />
        <ModeToggle />
      </div>
    </div>
  )
}

function FileMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">File</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>New Project</DropdownMenuItem>
        <DropdownMenuItem>Open Project</DropdownMenuItem>
        <DropdownMenuItem>Open Recent...</DropdownMenuItem>
        <DropdownMenuItem>Save</DropdownMenuItem>
        <DropdownMenuItem>Save As...</DropdownMenuItem>
        <DropdownMenuItem>Import...</DropdownMenuItem>
        <DropdownMenuItem>Export...</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EditMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Edit</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>Undo</DropdownMenuItem>
        <DropdownMenuItem>Redo</DropdownMenuItem>
        <DropdownMenuItem>Cut</DropdownMenuItem>
        <DropdownMenuItem>Copy</DropdownMenuItem>
        <DropdownMenuItem>Paste</DropdownMenuItem>
        <DropdownMenuItem>Select All</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HelpMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Help</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuItem>Documentation</DropdownMenuItem>
        <DropdownMenuItem>Community Forums</DropdownMenuItem>
        <DropdownMenuItem>Report a Bug</DropdownMenuItem>
        <DropdownMenuItem>About</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
