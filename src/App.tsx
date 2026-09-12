import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { I18nProvider } from "@/lib/i18n";
import { capturePendingReferral } from "@/lib/referral";

import { AuthProvider } from "@/components/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

// Pages
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import BrowseGroups from "@/pages/BrowseGroups";
import Dashboard from "@/pages/Dashboard";
import GroupDetail from "@/pages/GroupDetail";
import CreateGroup from "@/pages/CreateGroup";
import JoinGroup from "@/pages/JoinGroup";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";
import Wallet from "@/pages/Wallet";
import Support from "@/pages/Support";
import TermsOfService from "@/pages/TermsOfService";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import LegalCookie from "@/pages/legal/LegalCookie";
import LegalRimborsi from "@/pages/legal/LegalRimborsi";
import LegalNoteLegali from "@/pages/legal/LegalNoteLegali";
import LegalAmlKyc from "@/pages/legal/LegalAmlKyc";
import LegalDsa from "@/pages/legal/LegalDsa";
import LegalRegoleCondivisione from "@/pages/legal/LegalRegoleCondivisione";
import OperatorDashboard from "@/pages/OperatorDashboard";
import NotFound from "@/pages/NotFound";
import AdminFees from "@/pages/AdminFees";
import AdminConsole from "@/pages/AdminConsole";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import HowItWorks from "@/pages/HowItWorks";
import SavingsCalculatorPage from "@/pages/SavingsCalculatorPage";
import Referral from "@/pages/Referral";
import Contest from "@/pages/Contest";
import ContestRules from "@/pages/ContestRules";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,      // 2 min — data stays fresh between tab switches
      gcTime: 10 * 60 * 1000,         // 10 min cache before garbage collection
      refetchOnWindowFocus: false,     // Don't refetch when user returns to tab
      retry: 1,                        // Only 1 retry on failure
    },
  },
});

// One-time cleanup of mock data from localStorage
const cleanupMockData = () => {
  const cleanupFlag = 'mock_cleanup_done_v1';
  if (localStorage.getItem(cleanupFlag)) return;
  
  // Remove all mock data keys
  const keysToRemove = [
    'groups', 
    'memberships', 
    'messages', 
    'notifications', 
    'payments', 
    'currentUser', 
    'isLoggedIn'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Set flag so we don't do this again
  localStorage.setItem(cleanupFlag, 'true');
  console.log('🧹 Mock data cleanup completed');
};

const App = () => {
  useEffect(() => {
    // Clean up any leftover mock data once
    cleanupMockData();
    // Salva subito il codice referral presente nell'URL (?ref=XXXXXX)
    capturePendingReferral();
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/Auth" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/ComeFunziona" element={<HowItWorks />} />
                <Route path="/Calcolatore" element={<SavingsCalculatorPage />} />

                <Route path="/TermsOfService" element={<TermsOfService />} />
                <Route path="/PrivacyPolicy" element={<PrivacyPolicy />} />
                <Route path="/legal/cookie" element={<LegalCookie />} />
                <Route path="/legal/rimborsi" element={<LegalRimborsi />} />
                <Route path="/legal/note-legali" element={<LegalNoteLegali />} />
                <Route path="/legal/aml-kyc" element={<LegalAmlKyc />} />
                <Route path="/legal/dsa" element={<LegalDsa />} />
                <Route path="/legal/regole-condivisione" element={<LegalRegoleCondivisione />} />
                <Route path="/RegolamentoContest" element={<ContestRules />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Protected Routes */}
                <Route path="/BrowseGroups" element={
                  <ProtectedRoute>
                    <Layout currentPageName="BrowseGroups"><BrowseGroups /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Dashboard" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Dashboard"><Dashboard /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/GroupDetail" element={
                  <ProtectedRoute>
                    <Layout currentPageName="GroupDetail"><GroupDetail /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/CreateGroup" element={
                  <ProtectedRoute>
                    <Layout currentPageName="CreateGroup"><CreateGroup /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/JoinGroup" element={
                  <ProtectedRoute>
                    <Layout currentPageName="JoinGroup"><JoinGroup /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Messages" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Messages"><Messages /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Notifications" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Notifications"><Notifications /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Settings" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Settings"><Settings /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Wallet" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Wallet"><Wallet /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Referral" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Referral"><Referral /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Contest" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Contest"><Contest /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/Support" element={
                  <ProtectedRoute>
                    <Layout currentPageName="Support"><Support /></Layout>
                  </ProtectedRoute>
                } />
                
                {/* Admin */}
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <Layout currentPageName="AdminConsole"><AdminConsole /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/admin/fees" element={
                  <ProtectedRoute>
                    <Layout currentPageName="AdminFees"><AdminFees /></Layout>
                  </ProtectedRoute>
                } />
                <Route path="/OperatorDashboard" element={<OperatorDashboard />} />
                
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
