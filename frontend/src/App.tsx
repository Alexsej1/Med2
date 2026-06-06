import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DoctorLayout, RequireDoctor } from "./doctor/DoctorLayout";
import { DoctorDashboard } from "./doctor/DoctorDashboard";
import { DoctorPatients } from "./doctor/DoctorPatients";
import { DoctorPatientDetail } from "./doctor/DoctorPatientDetail";
import { DoctorConsultation } from "./doctor/DoctorConsultation";
import { DoctorConsultationDetail } from "./doctor/DoctorConsultationDetail";
import { DoctorCalendar } from "./doctor/DoctorCalendar";
import { DoctorHistory } from "./doctor/DoctorHistory";
import { DoctorLabAnalysis } from "./doctor/DoctorLabAnalysis";
import { AdminLayout, RequireAdmin } from "./admin/AdminLayout";
import { AdminConsultations } from "./admin/AdminConsultations";
import { AdminDoctors } from "./admin/AdminDoctors";
import { AdminPatients } from "./admin/AdminPatients";
import "./styles.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireDoctor />}>
            <Route path="/doctor" element={<DoctorLayout />}>
              <Route index element={<DoctorDashboard />} />
              <Route path="patients" element={<DoctorPatients />} />
              <Route path="patients/:id" element={<DoctorPatientDetail />} />
              <Route
                path="patients/:id/consultation"
                element={<DoctorConsultation />}
              />
              <Route
                path="patients/:id/lab-analysis"
                element={<DoctorLabAnalysis />}
              />
              <Route
                path="consultations/:consultationId"
                element={<DoctorConsultationDetail />}
              />
              <Route path="calendar" element={<DoctorCalendar />} />
              <Route path="history" element={<DoctorHistory />} />
            </Route>
          </Route>
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route
                index
                element={<Navigate to="/admin/patients" replace />}
              />
              <Route path="patients" element={<AdminPatients />} />
              <Route path="doctors" element={<AdminDoctors />} />
              <Route path="consultations" element={<AdminConsultations />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
