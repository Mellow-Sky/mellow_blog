'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion(), [entered, setEntered] = useState(false);
  useEffect(() => setEntered(true), []);
  return <motion.div initial={false} animate={entered && !reduced ? { opacity: [0.7, 1], y: [8, 0] } : { opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>{children}</motion.div>;
}
