import React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Primitive di scroll-reveal condivise.
 * Rispettano `prefers-reduced-motion`: in quel caso il contenuto appare senza traslazioni.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Ritardo in secondi */
  delay?: number;
  /** Distanza iniziale in px */
  y?: number;
  as?: "div" | "section" | "li" | "span" | "header" | "footer";
};

export function Reveal({ children, className, delay = 0, y = 24, as = "div" }: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Contenitore che mette in cascata i figli `RevealItem`. */
export function RevealGroup({
  children,
  className,
  stagger = 0.09,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
  as?: "div" | "ul" | "section";
}) {
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-70px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </MotionTag>
  );
}

export function RevealItem({
  children,
  className,
  y = 20,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
  as?: "div" | "li" | "article";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  const variants: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y },
    show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
  };

  return (
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
}

/** Titolo che entra parola per parola — usato solo per l'H1 dell'hero. */
export function RevealWords({
  text,
  className,
  delay = 0,
  highlightFrom,
}: {
  text: string;
  className?: string;
  delay?: number;
  /** Indice della parola da cui applicare l'accento colorato */
  highlightFrom?: number;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");

  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
    >
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className={
              highlightFrom !== undefined && i >= highlightFrom
                ? "inline-block text-primary"
                : "inline-block"
            }
            variants={{
              hidden: reduce ? { opacity: 0 } : { opacity: 0, y: "0.9em" },
              show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
            }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
