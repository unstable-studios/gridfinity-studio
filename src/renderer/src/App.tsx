import Logo from './components/Logo'
export default function App(): React.JSX.Element {
  return (
    <>
      {/* Planned layout:
          - Left floating sidebar: project tree
          - Right floating sidebar: tools
          - Main content area: editors, properties, etc.
          - Top bar: menu, app toolbar
          - Bottom bar: status, logs
      */}
      <div className="h-16 w-full border-b gap-4 border-gray-300 flex items-center px-4 shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700">
        <Logo />
      </div>
    </>
  )
}
