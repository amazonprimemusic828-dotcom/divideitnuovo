import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthContext";

import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import MarketingSections from "@/components/landing/MarketingSections";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Landing() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/BrowseGroups");
  }, [isAuthenticated, navigate]);

  const handleAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await login();
      if (result.success) {
        toast.success("Benvenuto in DIVIDEIT!");
        navigate("/BrowseGroups");
      } else {
        toast.error("Errore login: " + result.error);
      }
    } catch {
      toast.error("Errore durante il login");
    } finally {
      setIsLoading(false);
    }
  }, [login, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav onStart={handleAuth} isLoading={isLoading} />

      <main>
        <Hero onStart={handleAuth} isLoading={isLoading} />
        <MarketingSections onStart={handleAuth} />
      </main>

      <LandingFooter />
    </div>
  );
}
