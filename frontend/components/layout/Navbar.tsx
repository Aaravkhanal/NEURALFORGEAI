'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm'
          : 'bg-transparent'
      }`}
      style={{ height: 'var(--navbar-height, 64px)' }}
    >
      <div className="max-w-[1400px] mx-auto h-full flex items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold bg-primary shadow-sm">
            ⚡
          </span>
          <span className="font-bold text-lg tracking-tight text-foreground">
            NeuralForge
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { href: '#features', label: 'Features' },
            { href: '#how-it-works', label: 'How It Works' },
            { href: '#docs', label: 'Docs' },
            { href: '#about', label: 'About' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-bold bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            Start Free →
          </Link>
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-background border-b border-border p-6 space-y-4">
          <a href="#features" className="block text-sm font-medium text-muted-foreground">Features</a>
          <a href="#how-it-works" className="block text-sm font-medium text-muted-foreground">How It Works</a>
          <a href="#docs" className="block text-sm font-medium text-muted-foreground">Docs</a>
          <Link href="/login" className="block text-sm font-medium text-primary">Sign In</Link>
          <Link href="/dashboard" className="block text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-lg text-center">
            Start Free
          </Link>
        </div>
      )}
    </nav>
  );
}
