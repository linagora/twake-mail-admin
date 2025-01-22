import { Route, Routes } from "react-router";
import { AppSidebar } from "./components/side-bar";
import { SidebarProvider } from "./components/ui/sidebar";
import HealthCheck from "./pages/health-check";

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <Routes>
        <Route path="/health-check" element={<HealthCheck />} />
      </Routes>
    </SidebarProvider>
  );
}

export default App;
