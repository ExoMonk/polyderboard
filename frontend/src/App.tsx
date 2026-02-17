import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TraderDetail from "./pages/TraderDetail";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trader/:address" element={<TraderDetail />} />
      </Routes>
    </Layout>
  );
}
