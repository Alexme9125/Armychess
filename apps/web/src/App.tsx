import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/Home";
import { PvePage } from "./pages/Pve";
import { RoomPage } from "./pages/Room";
import { StudioPage } from "./pages/Studio";

export default function App() {
  return (
    <>
      <div className="bg-stage" />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/studio" element={<StudioPage />} />
        <Route path="/pve" element={<PvePage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
