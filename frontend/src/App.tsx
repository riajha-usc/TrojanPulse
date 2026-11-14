// Top-level router. Owner: Arin. Ask before editing.
//
//   /            student app (mobile), owned by Sharyu
//   /dashboard   Campus Pulse (desktop), owned by Arin
//
// Add screens inside src/mobile or src/dashboard, not here.

import { Route, Routes } from "react-router-dom";

import DashboardApp from "./dashboard/DashboardApp";
import MobileApp from "./mobile/MobileApp";

export default function App() {
  return (
    <Routes>
      <Route path="/dashboard/*" element={<DashboardApp />} />
      <Route path="/*" element={<MobileApp />} />
    </Routes>
  );
}
