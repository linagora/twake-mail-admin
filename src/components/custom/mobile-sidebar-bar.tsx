import { SidebarTrigger } from "../ui/sidebar";

// Below the `md` breakpoint (768 px, same as useIsMobile) the sidebar is a
// closed sheet: this bar provides the only touch entry point to navigation.
export function MobileSidebarBar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background px-2 md:hidden">
      <SidebarTrigger className="h-9 w-9" />
    </header>
  );
}
