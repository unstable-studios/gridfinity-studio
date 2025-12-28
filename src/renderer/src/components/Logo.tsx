import StudioLogo from '../assets/StudioIcon.svg?react'
export default function Logo(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <StudioLogo className="h-10 w-auto" />
      <span className="font-extrabold tracking-tight text-3xl">Gridfinity Studio</span>
    </div>
  )
}
