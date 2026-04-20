import { Outlet } from "react-router";
import Header from "@/components/custom/header";

const headerSubTitle = "Manage users registered on the DAV server.";

export default function RegisteredUsers() {
  return (
    <div className="p-4 w-fit">
      <Header headerTitle="Registered Users" headerSubTitle={headerSubTitle} docuUrl="" />
      <Outlet />
    </div>
  );
}
