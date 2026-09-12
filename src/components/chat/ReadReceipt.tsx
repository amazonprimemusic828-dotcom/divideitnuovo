import React from 'react';
import { motion } from 'framer-motion';

interface ReadReceiptProps {
  isRead: boolean;
  className?: string;
}

export default function ReadReceipt({ isRead, className = '' }: ReadReceiptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`inline-flex items-center ${className}`}
    >
      {isRead ? (
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="flex items-center"
        >
          {/* Double checkmarks - read */}
          <svg 
            width="18" 
            height="12" 
            viewBox="0 0 18 12" 
            fill="none"
            className="text-blue-400"
          >
            <path 
              d="M1 6L5 10L13 2" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M5 6L9 10L17 2" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      ) : (
        <div className="flex items-center">
          {/* Double checkmarks - sent (grey) */}
          <svg 
            width="18" 
            height="12" 
            viewBox="0 0 18 12" 
            fill="none"
            className="text-white/60"
          >
            <path 
              d="M1 6L5 10L13 2" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M5 6L9 10L17 2" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
}
