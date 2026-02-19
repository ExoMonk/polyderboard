import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TraderDetail from "./pages/TraderDetail";
import Activity from "./pages/Activity";
import MarketDetail from "./pages/MarketDetail";
import Alerts from "./pages/Alerts";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trader/:address" element={<TraderDetail />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/market/:tokenId" element={<MarketDetail />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </Layout>
  );
}
