import Logo from './Logo'

function NavItem(props: { label: string; href: string }): React.JSX.Element {
  return (
    <a
      href={props.href}
      className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-md font-semibold cursor-pointer"
    >
      {props.label}
    </a>
  )
}

export default function Navbar(): React.JSX.Element {
  return (
    <div className="h-16 w-full border-b gap-4 border-gray-300 flex items-center justify-between px-4 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
      <Logo />
      <div>
        <NavItem label="File" href="#" />
        <NavItem label="Edit" href="#" />
        <NavItem label="View" href="#" />
        <NavItem label="Help" href="#" />
      </div>
    </div>
  )
}
