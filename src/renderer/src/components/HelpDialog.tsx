import Markdown from 'react-markdown'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import help from '../../../../docs/HELP.md?raw'

// The document's own title is the dialog's title.
const [titleLine, ...body] = help.split('\n')
const TITLE = titleLine.replace(/^#\s*/, '')
const BODY = body.join('\n')

/** The user guide in `docs/HELP.md`, shown in the app. */
export default function HelpDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-2 text-sm text-zinc-700 dark:text-zinc-300">
          <Markdown
            components={{
              h2: ({ children }) => (
                <h2 className="pt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {children}
                </h2>
              ),
              ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
              strong: ({ children }) => (
                <strong className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {children}
                </strong>
              ),
              code: ({ children }) => (
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
                  {children}
                </code>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline dark:text-blue-400"
                >
                  {children}
                </a>
              )
            }}
          >
            {BODY}
          </Markdown>
        </div>
      </DialogContent>
    </Dialog>
  )
}
