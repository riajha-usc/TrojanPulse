// Student app shell. Owner: Sharyu.
// Routes for the four mobile screens. Placeholders only; build each screen in ./pages.

import { Route, Routes } from "react-router-dom";

import AlertCountdown from "./pages/AlertCountdown";
import AlertSent from "./pages/AlertSent";
import StartWalk from "./pages/StartWalk";
import WalkMode from "./pages/WalkMode";

export default function MobileApp() {
  return (
    <Routes>
      <Route path="/" element={<StartWalk />} />
      <Route path="/walk" element={<WalkMode />} />
      <Route path="/alert" element={<AlertCountdown />} />
      <Route path="/alert/sent" element={<AlertSent />} />
    </Routes>
  );
}
