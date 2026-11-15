// Top-level router. Owner: Arin. Ask before editing.
//
//   /            student app (mobile), owned by Sharyu
//   /dashboard   Campus Pulse (desktop), owned by Arin
//   /dev/map     shared map preview, dev server only
//
// Add screens inside src/mobile or src/dashboard, not here.

import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

import DashboardApp from "./dashboard/DashboardApp";
import MobileApp from "./mobile/MobileApp";

// Dev-only preview of the shared map. Left out of production builds.
const MapDemo = import.meta.env.DEV ? lazy(() => import("./shared/components/MapDemo")) : null;

export default function App() {
  return (
    <Routes>
      {MapDemo && (
        <Route
          path="/dev/map"
          element={
            <Suspense fallback={null}>
              <MapDemo />
            </Suspense>
          }
        />
      )}
      <Route path="/dashboard/*" element={<DashboardApp />} />
      <Route path="/*" element={<MobileApp />} />
    </Routes>
  );
}
