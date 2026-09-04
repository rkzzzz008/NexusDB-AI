import React, { useState } from 'react';
import {
  Sparkles,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart2,
  Table,
  CheckCircle2,
  Layers,
  Search,
  Globe,
  ChevronDown,
} from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenAuth?: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onOpenAuth }) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const features = [
    {
      icon: <Database className="w-6 h-6 text-blue-500" />,
      title: 'Universal No-Code Databases',
      description:
        'Create custom databases for Students, Inventory, HR, CRM, Patients, or any unique domain in seconds.',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-500" />,
      title: 'Gemini AI Natural Language',
      description:
        'Ask questions in plain English like "Show students with attendance below 75%" and get instant insights.',
    },
    {
      icon: <Table className="w-6 h-6 text-emerald-500" />,
      title: 'Dynamic Input & Grid Views',
      description:
        'Auto-generate form inputs, table grids, column filters, search bars, and bulk CSV importers.',
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-amber-500" />,
      title: 'Live Real-Time Analytics',
      description:
        'Watch bar charts, pie breakdowns, and line trends update automatically as data enters.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-violet-500" />,
      title: 'JWT Auth & Role-Based Access',
      description:
        'Role security with Admin, Editor, and Viewer permissions to safeguard critical organizational data.',
    },
    {
      icon: <Zap className="w-6 h-6 text-rose-500" />,
      title: 'Export CSV, Excel & PDF',
      description:
        'Instant export options to download data for reports or integrate seamlessly into existing workflows.',
    },
  ];

  const pricingTiers = [
    {
      name: 'Free Starter',
      price: '$0',
      period: 'forever',
      description: 'Ideal for small projects and individual database creators.',
      features: [
        'Up to 3 Custom Databases',
        '1,000 Records per database',
        'Basic AI Assistant Queries',
        'CSV Import / Export',
        'Standard Role Permissions',
      ],
      buttonText: 'Get Started Free',
      highlighted: false,
    },
    {
      name: 'Pro SaaS',
      price: '$29',
      period: 'per month',
      description: 'Perfect for growing teams needing full AI power & unlimited databases.',
      features: [
        'Unlimited Custom Databases',
        '100,000 Records per database',
        'Full Gemini 3.6 Flash AI Assistant',
        'Auto-Generated Recharts Analytics',
        'Role-Based Auth (Admin, Editor, Viewer)',
        'PDF Report Generation & System Logs',
      ],
      buttonText: 'Start Pro Trial',
      highlighted: true,
    },
    {
      name: 'Enterprise Hub',
      price: '$99',
      period: 'per month',
      description: 'Dedicated cloud infrastructure for high-scale enterprise operations.',
      features: [
        'Unlimited Records & Storage',
        'Dedicated Cloud SQL / MongoDB cluster',
        'Custom AI fine-tuning & prompt tools',
        '24/7 Priority SLA & Audit Logs',
        'Custom Single Sign-On (SSO)',
      ],
      buttonText: 'Contact Enterprise',
      highlighted: false,
    },
  ];

  const testimonials = [
    {
      quote:
        'NexusDB AI transformed our university department. We built student records, attendance logs, and project trackers in under 10 minutes without touching a line of code.',
      author: 'Prof. Marcus Thorne',
      role: 'Dean of Computer Science, Tech University',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
    {
      quote:
        'The Gemini AI feature is incredible. Being able to ask "Which employee has highest salary?" or "Show low stock SKUs" directly saves us hours every week.',
      author: 'Sarah Lin',
      role: 'Head of Operations, Global Logistics',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
  ];

  const faqs = [
    {
      q: 'What is NexusDB AI?',
      a: 'NexusDB AI is an intelligent universal data management platform where users can construct custom databases with zero coding required and query them with natural language powered by Gemini AI.',
    },
    {
      q: 'What field types are supported?',
      a: 'NexusDB AI supports 11 field types including Text, Number, Email, Phone, Date, Boolean, Dropdown, Checkbox, Image Upload, File Upload, Long Text, and URL.',
    },
    {
      q: 'How does the AI Assistant work?',
      a: 'The AI Assistant connects to server-side Gemini 3.6 Flash models to analyze your active database schema and records. You can ask for filters, anomalies, duplicate records, or executive summaries in plain English.',
    },
    {
      q: 'Can I export my data?',
      a: 'Yes, you can export your records to CSV, Excel format, JSON, or print formatted PDF summary reports at any time.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Glow Backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-blue-600/20 via-indigo-600/20 to-purple-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Next-Gen Intelligent Universal Data Platform
          </span>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Build Any Database. <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">
              Analyze Everything.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Create custom databases for Student Management, Inventory, HR, CRM, and Hospital records in seconds. Powered by Gemini AI for instant natural language insights.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#features"
              className="px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-sm transition-all"
            >
              Learn More
            </a>
          </div>
        </motion.div>

        {/* Hero Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-16 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-4 sm:p-6 text-left max-w-5xl mx-auto backdrop-blur-xl relative"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500" />
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-2 text-xs text-slate-400 font-mono">nexusdb.ai/app/student-management</span>
            </div>
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Demo Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-400">Active Databases</div>
              <div className="text-2xl font-bold text-white mt-1">5 Templates</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-400">Total Records</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">2,480 Entries</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div className="text-xs text-slate-400">AI Gemini Accuracy</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">99.8%</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/40 to-slate-900 border border-blue-800/50 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
            <p className="text-xs text-slate-200">
              <strong className="text-blue-300">AI Prompt Executed:</strong> "Show students with attendance below 75%" &rarr; <span className="text-emerald-300">Flagged 2 records with academic probation alert.</span>
            </p>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">Built for Every Organizational Workflow</h2>
          <p className="text-slate-400 mt-2 text-sm max-w-xl mx-auto">
            From university departments to warehouse logistics and hospital wards, NexusDB AI handles custom schema logic effortlessly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-700 transition-all hover:-translate-y-1 group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-base font-bold text-white mb-2">{f.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white">Simple, Transparent SaaS Pricing</h2>
          <p className="text-slate-400 mt-2 text-sm">Choose the tier that fits your team scale.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingTiers.map((p, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border relative flex flex-col justify-between ${
                p.highlighted
                  ? 'bg-gradient-to-b from-blue-950/60 to-slate-900 border-blue-500/80 shadow-2xl shadow-blue-500/10'
                  : 'bg-slate-800/40 border-slate-800'
              }`}
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-widest">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{p.description}</p>
                <div className="my-6">
                  <span className="text-4xl font-extrabold text-white">{p.price}</span>
                  <span className="text-xs text-slate-400 ml-2">/ {p.period}</span>
                </div>

                <ul className="space-y-3 my-6">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={onGetStarted}
                className={`w-full py-3 rounded-xl text-xs font-bold transition-all ${
                  p.highlighted
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {p.buttonText}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 max-w-5xl mx-auto border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Loved by Operations & Technical Teams</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-800">
              <p className="text-xs text-slate-300 italic leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-3 mt-6">
                <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <h4 className="text-xs font-bold text-white">{t.author}</h4>
                  <p className="text-[10px] text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-20 px-6 max-w-3xl mx-auto border-t border-slate-800">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl bg-slate-800/50 border border-slate-800 overflow-hidden">
              <button
                onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                className="w-full text-left p-4 flex items-center justify-between text-xs font-semibold text-white hover:bg-slate-800/80 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${activeFaq === i ? 'rotate-180' : ''}`} />
              </button>
              {activeFaq === i && (
                <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 mt-2">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t border-slate-800 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-white">NexusDB AI Platform</span>
          </div>
          <p>© 2026 NexusDB AI. All rights reserved. Universal Intelligent Data Management.</p>
        </div>
      </footer>
    </div>
  );
};
