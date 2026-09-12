import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export default function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} sta scrivendo`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} e ${typingUsers[1]} stanno scrivendo`;
    } else {
      return `${typingUsers[0]} e altri ${typingUsers.length - 1} stanno scrivendo`;
    }
  };

  return (
    <AnimatePresence mode="wait">
      {typingUsers.length > 0 && (
        <motion.div
          key="typing-indicator"
          initial={{ opacity: 0, y: 8, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 0 }}
          exit={{ opacity: 0, y: 8, height: 0, marginTop: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex items-center gap-2 bg-muted/70 backdrop-blur-sm rounded-full px-3.5 py-2 shadow-sm border border-border/30">
              {/* Animated dots - chat bubble style */}
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full"
                    animate={{
                      scale: [0.8, 1.2, 0.8],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              
              {/* Text */}
              <motion.span 
                className="text-xs text-muted-foreground font-medium whitespace-nowrap"
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                {getTypingText()}
              </motion.span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
