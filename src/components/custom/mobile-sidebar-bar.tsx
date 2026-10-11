import { useEffect } from "react";
import { useLocation } from "react-router";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";

// Below the `md` breakpoint (768 px, same as useIsMobile) the sidebar is a
// closed sheet: this bar provides the only touch entry point to navigation.
export function MobileSidebarBar() {
  useCloseMobileSidebarOnNavigation();

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b bg-background px-2 md:hidden">
      <SidebarTrigger className="h-9 w-9" />
    </header>
  );
}

// The mobile sheet overlays the page: once an entry is chosen, close it so
// the destination page is visible.
function useCloseMobileSidebarOnNavigation() {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();

  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
}
