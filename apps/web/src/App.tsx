import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Auth
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import OperationsLayout from './layouts/OperationsLayout';

// Pages
import Landing from './pages/Landing/Landing';
import CommandCenter from './pages/CommandCenter/CommandCenter';
import Incidents from './pages/Incidents/Incidents';
import Resources from './pages/Resources/Resources';
import Requests from './pages/Requests/Requests';
import Vehicles from './pages/Vehicles/Vehicles';
import Shelters from './pages/Shelters/Shelters';
import Analytics from './pages/Analytics/Analytics';
import IncidentWorkspace from './pages/Incidents/IncidentWorkspace';
import DemandMatching from './pages/Matching/DemandMatching';
import Dispatch from './pages/Dispatch/Dispatch';
import Delivery from './pages/Delivery/Delivery';
import LogisticsOptimizer from './pages/Optimizer/LogisticsOptimizer';
import NotFound from './pages/NotFound/NotFound';
import OfficerLogin from './pages/OfficerLogin/OfficerLogin';
import ForgotPassword from './pages/OfficerLogin/ForgotPassword';

import Report from './pages/Report/Report';
import Help from './pages/Help/Help';
import { OperationalStateProvider } from './context/OperationalStateContext';
import { SmoothScrollProvider } from './motion/scroll/LenisProvider';
import BootScreen from './components/BootScreen/BootScreen';

import PageTransition from './components/ui/PageTransition';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

import { ToastContainer } from './components/ui/SystemStates';
import { useOperationalState } from './context/OperationalStateContext';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppRoutes: React.FC = () => {
  const { toasts, removeToast } = useOperationalState();

  return (
    <>
      <ScrollToTop />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageTransition>
        {(displayLocation) => (
          <Routes location={displayLocation}>

            {/* ── Public routes (no auth required) ── */}
            <Route path="/" element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="report" element={<Report />} />
              <Route path="help" element={<Help />} />

              {/* Officer auth routes (outside OperationsLayout) */}
              <Route path="officer/login" element={<OfficerLogin />} />
              <Route path="officer/forgot-password" element={<ForgotPassword />} />

              {/* Public read-only registries */}
              <Route path="shelters" element={<Shelters />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="resources" element={<Resources />} />
              <Route path="requests" element={<Requests />} />
              <Route path="vehicles" element={<Vehicles />} />

              <Route path="operations/incidents" element={<Incidents />} />
              <Route path="operations/incidents/:incidentId/response" element={<IncidentWorkspace />} />
              <Route path="operations/resources" element={<Resources />} />
              <Route path="operations/requests" element={<Requests />} />
              <Route path="operations/vehicles" element={<Vehicles />} />
              <Route path="operations/shelters" element={<Shelters />} />
              <Route path="operations/analytics" element={<Analytics />} />
              <Route path="operations/optimizer" element={<LogisticsOptimizer />} />
              <Route path="operations/routes" element={<LogisticsOptimizer />} />

              {/* ── Protected Command Board (authentication required) ── */}
              <Route
                path="operations"
                element={
                  <ProtectedRoute>
                    <OperationsLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/operations/command-center" replace />} />
                <Route path="command-center" element={<CommandCenter />} />
                <Route path="matching" element={<DemandMatching />} />
                <Route path="optimizer" element={<LogisticsOptimizer />} />
                <Route path="routes" element={<LogisticsOptimizer />} />
                <Route path="dispatch" element={<Dispatch />} />
                <Route path="delivery" element={<Delivery />} />
                <Route path="incidents" element={<Incidents />} />
                <Route path="resources" element={<Resources />} />
                <Route path="requests" element={<Requests />} />
                <Route path="vehicles" element={<Vehicles />} />
                <Route path="shelters" element={<Shelters />} />
                <Route path="incidents/:incidentId" element={<IncidentWorkspace />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </PageTransition>
    </>
  );
};

export const App: React.FC = () => {
  const [showBoot, setShowBoot] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('saksham_boot_seen');
    }
    return true;
  });

  const handleBootComplete = () => {
    sessionStorage.setItem('saksham_boot_seen', 'true');
    setShowBoot(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OperationalStateProvider>
          <SmoothScrollProvider>
            {showBoot && <BootScreen onComplete={handleBootComplete} />}
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SmoothScrollProvider>
        </OperationalStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
