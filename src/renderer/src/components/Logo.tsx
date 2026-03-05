import StudioLogo from '../assets/StudioIcon.svg?react'
export default function Logo(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <StudioLogo className="h-8 w-auto shrink-0" />
      <span className="font-extrabold tracking-tight text-xl truncate">Gridfinity Studio</span>
    </div>
  )
}
