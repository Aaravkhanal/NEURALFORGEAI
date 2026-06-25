import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { ReactNode } from 'react';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: 'NeuralForge — Your AI ML Engineer',
  description: 'NeuralForge coordinates 10 specialized AI agents to guide you from problem formulation to containerized deployment. End-to-end ML automation.',
  keywords: 'machine learning, AI, ML pipeline, NeuralForge, AutoML, data science, model training, deployment, NVIDIA, LangGraph, multi-agent',
  authors: [{ name: 'NeuralForge — Team Paranoid Android' }],
  openGraph: {
    title: 'NeuralForge — Your AI ML Engineer',
    description: '10 specialized AI agents coordinate to automate your entire ML workflow — from datasets to deployment.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
