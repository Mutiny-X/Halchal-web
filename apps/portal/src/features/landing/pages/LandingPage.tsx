import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  IndianRupee,
  Instagram,
  Menu,
  Play,
  Sparkles,
  Twitter,
  X,
  Youtube,
} from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { dashboardPathForRole } from "@/lib/portal";
import { HalchalMark } from "@/components/brand/halchal-mark";
import { GrainOverlay, Magnetic, ScrollProgress } from "@/features/landing/components/atmosphere";
import {
  Reveal,
  StaggerGroup,
  StaggerItem,
  fadeUp,
  staggerContainer,
} from "@/features/landing/components/motion-primitives";
import { VerificationPanel } from "@/features/landing/components/verification-panel";
import { SignalMap } from "@/features/landing/components/signal-map";
import { HowItWorksSticky } from "@/features/landing/components/how-it-works-sticky";
import { BentoFeatures } from "@/features/landing/components/bento-features";
import { RateCalculator } from "@/features/landing/components/rate-calculator";

// Deployed as its own Railway service (Login with Instagram → Profile /
// Feed / Quick Reply / Post / Insights / Logout).
const CLIPPER_LOGIN_URL = "https://halchal-clipper-site-production.up.railway.app";

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], ["rgba(7,9,26,0.35)", "rgba(7,9,26,0.92)"]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ backgroundColor: navBg }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <HalchalMark className="h-7 w-auto" />
          <span className="font-display text-lg font-bold text-white">Halchal</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-sm text-white/60 transition-colors hover:text-white">
            How it works
          </a>
          <a href="#for-clippers" className="text-sm text-white/60 transition-colors hover:text-white">
            For clippers
          </a>
          <a href="#pricing" className="text-sm text-white/60 transition-colors hover:text-white">
            Pricing
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={CLIPPER_LOGIN_URL}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <Instagram className="h-3.5 w-3.5" />
            Clipper Login
          </a>
          {auth ? (
            <Magnetic>
              <Link
                to={dashboardPathForRole(auth.user.role)}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
              >
                Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Magnetic>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-white/70 transition-colors hover:text-white">
                Team sign in
              </Link>
              <Magnetic>
                <Link
                  to="/support"
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Talk to us <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Magnetic>
            </>
          )}
        </div>

        <button className="text-white/70 hover:text-white md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#07091A] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white" onClick={() => setOpen(false)}>
              How it works
            </a>
            <a href="#for-clippers" className="text-sm text-white/60 hover:text-white" onClick={() => setOpen(false)}>
              For clippers
            </a>
            <a href="#pricing" className="text-sm text-white/60 hover:text-white" onClick={() => setOpen(false)}>
              Pricing
            </a>
            <a
              href={CLIPPER_LOGIN_URL}
              className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white"
              onClick={() => setOpen(false)}
            >
              <Instagram className="h-3.5 w-3.5" />
              Clipper Login
            </a>
            <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
              {auth ? (
                <Link
                  to={dashboardPathForRole(auth.user.role)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Go to Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-center text-sm text-white/70">Team sign in</Link>
                  <Link
                    to="/support"
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Talk to us
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-[#07091A] px-6 py-32">
      <div
        className="bg-dot-grid pointer-events-none absolute inset-0"
        style={{
          maskImage: "radial-gradient(ellipse 60% 55% at 28% 30%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 28% 30%, black, transparent 70%)",
        }}
      />
      <div className="animate-float pointer-events-none absolute -left-32 top-0 h-125 w-125 rounded-full bg-primary/15 blur-[140px]" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.div initial="hidden" animate="show" variants={staggerContainer}>
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" />
            India's regional-first clipping platform
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="font-display mb-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            Stop paying creators for promises.{" "}
            <span className="bg-linear-to-r from-primary via-violet-400 to-purple-300 bg-clip-text text-transparent">
              Pay for proof.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} className="mb-10 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            Halchal connects Indian brands with clippers across every region —
            not just pan-India, English-first creators. Brief it in Hindi,
            Tamil, Telugu, Bengali or any state you target, post to Instagram,
            YouTube or X, and pay only for views we independently verify.
          </motion.p>

          <motion.div variants={fadeUp} className="mb-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Magnetic>
              <Link
                to="/support"
                className="group flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(99,14,212,0.5)] transition hover:bg-primary/90 hover:shadow-[0_0_60px_rgba(99,14,212,0.6)]"
              >
                Launch a campaign
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </Magnetic>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              <Play className="h-4 w-4" />
              See how verification works
            </a>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/40">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              Built for regional India, not just metros
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              No monthly fees
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-primary" />
              Every view independently verified
            </span>
          </motion.div>
        </motion.div>

        <div className="flex justify-center lg:justify-end">
          <VerificationPanel />
        </div>
      </div>

      <a
        href="#regions"
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 animate-bounce text-white/30 transition-colors hover:text-white/60 sm:block"
      >
        <ChevronDown className="h-6 w-6" />
      </a>
    </section>
  );
}

// ─── Regions ──────────────────────────────────────────────────────────────────

function Regions() {
  return (
    <section id="regions" className="border-y border-white/10 bg-[#07091A] py-24">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
            Not just metro, not just English
          </p>
          <h2 className="font-display mb-4 text-2xl font-black text-white sm:text-3xl">
            Halchal speaks every region your audience does
          </h2>
          <p className="mx-auto max-w-lg text-sm text-white/50">
            One brief broadcasts to clippers across every state and language you target.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <SignalMap />
        </Reveal>
      </div>
    </section>
  );
}

// ─── For clippers ─────────────────────────────────────────────────────────────

const platformBadges = [
  {
    icon: Instagram,
    platform: "Instagram",
    desc: "Reels & Posts",
    color: "from-pink-500/20 to-orange-500/20",
    border: "border-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Youtube,
    platform: "YouTube",
    desc: "Shorts",
    color: "from-red-500/20 to-red-600/20",
    border: "border-red-500/20",
    iconColor: "text-red-400",
  },
  {
    icon: Twitter,
    platform: "X",
    desc: "Tweets",
    color: "from-sky-500/20 to-blue-600/20",
    border: "border-sky-500/20",
    iconColor: "text-sky-400",
  },
];

function ForClippers() {
  return (
    <section id="for-clippers" className="bg-[#0A0E1F] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="overflow-hidden rounded-3xl border border-primary/20 bg-linear-to-br from-primary/20 via-primary/10 to-transparent p-8 sm:p-12">
          <div className="grid gap-12 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">For clippers</p>
              <h2 className="font-display mb-5 text-3xl font-black text-white sm:text-4xl">
                Regional creators welcome first, not an afterthought
              </h2>
              <p className="mb-8 leading-relaxed text-white/60">
                Join campaigns from Indian brands. Submit your content, get it
                approved, post it live, and earn money based on the verified
                views you generate — in whatever language your audience speaks.
              </p>

              <ul className="mb-8 space-y-3">
                {[
                  "Free to join — no subscription needed",
                  "Work with verified Indian brands",
                  "Earn per 1,000 verified views on Instagram, YouTube & X",
                  "Cash out to UPI or bank once it clears review",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <Magnetic className="inline-block">
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-[#07091A] transition hover:bg-white/90"
                >
                  Join as a clipper <ArrowRight className="h-4 w-4" />
                </Link>
              </Magnetic>
            </div>

            <StaggerGroup className="flex flex-col gap-4">
              {platformBadges.map((p) => (
                <StaggerItem
                  key={p.platform}
                  className={`flex items-center gap-4 rounded-2xl border ${p.border} bg-linear-to-r ${p.color} p-5`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ${p.iconColor}`}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-white">{p.platform}</p>
                    <p className="text-sm text-white/50">{p.desc}</p>
                  </div>
                  <div className="ml-auto">
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                      Active
                    </span>
                  </div>
                </StaggerItem>
              ))}

              <StaggerItem className="rounded-2xl border border-white/10 bg-white/3 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <IndianRupee className="h-5 w-5 text-green-400" />
                  <span className="font-bold text-white">Transparent earnings</span>
                </div>
                <p className="text-sm text-white/50">
                  See exactly how much you'll earn per view before you accept a campaign. No hidden fees.
                </p>
              </StaggerItem>
            </StaggerGroup>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="bg-[#07091A] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-16 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="font-display text-3xl font-black text-white sm:text-4xl">
            No tiers. No retainers. You set the price.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            There's no fixed plan to pick from — every campaign carries its own rate, cap and budget, set by you.
          </p>
        </Reveal>

        <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
          <Reveal delay={0.1}>
            <ul className="space-y-5">
              {[
                {
                  title: "Set your own rate per campaign",
                  desc: "Every brief carries its own price per 1,000 views — never a locked-in plan.",
                },
                {
                  title: "Cap spend per clipper",
                  desc: "A per-creator maximum keeps any single campaign from running away on budget.",
                },
                {
                  title: "Pay only once views are verified",
                  desc: "Money moves after we independently confirm the view count — not before.",
                },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="text-sm leading-relaxed text-white/50">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.2}>
            <RateCalculator />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="bg-[#0A0E1F] px-6 py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-b from-primary/20 to-primary/5 p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="animate-float absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-[80px]" />
          </div>
          <div className="relative">
            <h2 className="font-display mb-5 text-3xl font-black text-white sm:text-4xl">
              Ready to reach every region in India?
            </h2>
            <p className="mb-8 text-white/60">
              Set your brief, your rate, your regions — Halchal handles the review and the verified payouts.
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Magnetic>
                <Link
                  to="/support"
                  className="group flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-white shadow-[0_0_30px_rgba(99,14,212,0.4)] transition hover:bg-primary/90"
                >
                  Talk to our team
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
              </Magnetic>
              <Link to="/login" className="text-sm text-white/50 transition-colors hover:text-white">
                Halchal team? Sign in
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#07091A] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <Link to="/" className="mb-4 flex items-center gap-2">
              <HalchalMark className="h-6 w-auto" animated={false} />
              <span className="font-display font-bold text-white">Halchal</span>
            </Link>
            <p className="text-sm leading-relaxed text-white/40">
              India's regional-first clipping platform.
            </p>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Platform</p>
            <ul className="space-y-3">
              {[
                { label: "For brands", to: "/support" },
                { label: "For clippers", to: "/support" },
                { label: "Pricing", to: "#pricing" },
                { label: "Team sign in", to: "/login" },
              ].map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-white/50 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Company</p>
            <ul className="space-y-3">
              {["About", "Blog", "Careers", "Contact"].map((l) => (
                <li key={l}>
                  <span className="cursor-not-allowed text-sm text-white/50">{l}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Legal</p>
            <ul className="space-y-3">
              <li>
                <Link to="/privacy" className="text-sm text-white/50 transition-colors hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-white/50 transition-colors hover:text-white">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/delete-account" className="text-sm text-white/50 transition-colors hover:text-white">
                  Delete Account
                </Link>
              </li>
              <li>
                <Link to="/support" className="text-sm text-white/50 transition-colors hover:text-white">
                  Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-xs text-white/30">
            © {new Date().getFullYear()} Mutiny Talent Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white">
              Privacy Policy
            </Link>
            <span className="text-xs text-white/20">·</span>
            <Link to="/terms" className="text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white">
              Terms of Service
            </Link>
            <span className="text-xs text-white/20">·</span>
            <Link to="/support" className="text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white">
              Support
            </Link>
            <span className="text-xs text-white/20">·</span>
            <p className="text-xs text-white/30">Made with ❤️ in India</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <GrainOverlay />
      <ScrollProgress />
      <Nav />
      <Hero />
      <Regions />
      <HowItWorksSticky />
      <BentoFeatures />
      <ForClippers />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}
