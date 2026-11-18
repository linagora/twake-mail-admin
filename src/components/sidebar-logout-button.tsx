import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useOIDC } from "@/components/custom/oidc-provider";
import { useAuth } from "@/components/custom/auth-provider";
import { appConfig } from "@/lib/config";

function LogoutMenuItem({ onLogout }: Readonly<{ onLogout: () => void }>) {
  const { t } = useTranslation();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={onLogout}>
        <LogOut />
        <span>{t("sidebar.logout")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function OidcLogoutButton() {
  const { logout } = useOIDC();
  return <LogoutMenuItem onLogout={logout} />;
}

// Static-token mode: forgets the WebAdmin token, then reloads so that the next call prompts for one
function StaticTokenLogoutButton() {
  const { isAuthenticated, clearToken } = useAuth();
  if (!isAuthenticated) return null;
  const logout = () => {
    clearToken();
    window.location.reload();
  };
  return <LogoutMenuItem onLogout={logout} />;
}

export function SidebarLogoutButton() {
  return appConfig.sso ? <OidcLogoutButton /> : <StaticTokenLogoutButton />;
}
