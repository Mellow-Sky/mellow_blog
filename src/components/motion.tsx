'use client';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { useRef, type ReactNode, type MouseEvent } from 'react';

export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={false} whileInView={reduced ? { opacity: 1, y: 0 } : { opacity: [0.4, 1], y: [16, 0] }} viewport={{ once: true, amount: 0.08 }} style={{ opacity: 1 }} transition={{ duration: 0.6, delay, ease: [0.2, 0.65, 0.3, 1] }}>{children}</motion.div>;
}
export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rotateX = useSpring(y, { stiffness: 180, damping: 22 }), rotateY = useSpring(x, { stiffness: 180, damping: 22 });
  function move(e: MouseEvent<HTMLDivElement>) {
    if (reduced || !window.matchMedia('(pointer:fine)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width - 0.5) * 7);
    y.set(-((e.clientY - rect.top) / rect.height - 0.5) * 7);
  }
  return <motion.div className={className} onMouseMove={move} onMouseLeave={() => { x.set(0); y.set(0); }} style={{ rotateX, rotateY, transformPerspective: 1200 }} whileHover={reduced ? undefined : { scale: 1.015, y: -4 }} transition={{ duration: 0.3 }}>{children}</motion.div>;
}
export function Magnetic({ children, className = '', href }: { children: ReactNode; className?: string; href: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  return <motion.a href={href} className={className} style={{ x: useSpring(x, { stiffness: 220, damping: 16 }), y: useSpring(y, { stiffness: 220, damping: 16 }) }} onMouseMove={e => {
    if (reduced || !window.matchMedia('(pointer:fine)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.18); y.set((e.clientY - rect.top - rect.height / 2) * 0.18);
  }} onMouseLeave={() => { x.set(0); y.set(0); }}>{children}</motion.a>;
}
export function Parallax({ children, className = '', speed = 50 }: { children: ReactNode; className?: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const reduced = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : speed]);
  return <motion.div ref={ref} style={{ y }} className={className}>{children}</motion.div>;
}
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return <motion.div aria-hidden className="reading-progress" style={{ scaleX }} />;
}
