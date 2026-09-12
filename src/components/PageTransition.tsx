import React from "react";
import { motion } from "framer-motion";

export default function PageTransition() {
  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      exit={{ scaleX: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] gradient-divideit origin-left"
    />
  );
}
