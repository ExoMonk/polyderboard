import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import Layout from "./components/Layout";
import AuthGate from "./components/AuthGate";
import Dashboard from "./pages/Dashboard";
import TraderDetail from "./pages/TraderDetail";
import Activity from "./pages/Activity";
import MarketDetail from "./pages/MarketDetail";
import Alerts from "./pages/Alerts";
import { pageTransition } from "./lib/motion";

export default function App() {
  const location = useLocation();

  return (
    <AuthGate>
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={pageTransition}
        >
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trader/:address" element={<TraderDetail />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/market/:tokenId" element={<MarketDetail />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Layout>
    </AuthGate>
  );
}
