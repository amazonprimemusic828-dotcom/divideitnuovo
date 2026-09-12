import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import ReviewApp from "./preview/ReviewApp";
import "./index.css";

// Temporary visual review requested by the owner. The live app is lazy-loaded only
// when this flag is disabled, so review cannot initialize auth, data or payment clients.
const FRONTEND_REVIEW_ENABLED = true;
const LiveApp = lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  FRONTEND_REVIEW_ENABLED ? <ReviewApp /> : <Suspense fallback={<div className="min-h-screen bg-background" role="status" aria-label="Caricamento applicazione" />}><LiveApp /></Suspense>,
);
