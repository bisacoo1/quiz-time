"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  Brain,
  FileText,
  Sparkles,
  Star,
  Target,
  Users,
  Library,
  BookOpen,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Turn notes into flashcards",
    description:
      "Start with a PDF, Word document, photo, or pasted notes. QuizTime helps turn your material into a study set.",
    tone: "violet",
  },
  {
    icon: Brain,
    title: "Practice your way",
    description:
      "Study with flashcards, take a multiple-choice exam, practice identification, or recall every item in a list.",
    tone: "orange",
  },
  {
    icon: Target,
    title: "Remember what you learn",
    description:
      "Spaced Review brings back the cards you are most likely to forget, right when a little practice can help.",
    tone: "green",
  },
  {
    icon: Sparkles,
    title: "Read with an AI study partner",
    description:
      "Open a PDF or DOCX beside the tutor. Ask about a passage, save real highlights, and add your own notes.",
    tone: "blue",
  },
];

function AnimatedNumber({ value }: { value: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const startValue = 0;
    const duration = 1200;
    const startTime = performance.now();

    const updateCounter = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const val = Math.floor(startValue + (value - startValue) * easedProgress);
      setCurrent(val);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCounter);
      } else {
        setCurrent(value);
      }
    };

    animationFrameId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toLocaleString();
  };

  return <>{formatNumber(current)}</>;
}

function PublicStats() {
  const [stats, setStats] = useState<{
    students: number;
    cardsCreated: number;
    cardsBeingStudied: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/public-stats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch public stats:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  const items = [
    {
      label: "Real Students",
      value: stats?.students ?? 0,
      subtext: "STUDYING ON QUIZTIME",
    },
    {
      label: "Real Numbers",
      value: stats?.cardsCreated ?? 0,
      subtext: "CARDS CREATED",
    },
    {
      label: "Right Now",
      value: stats?.cardsBeingStudied ?? 0,
      subtext: "CARDS STUDIED",
    },
  ];

  if (isLoading) {
    return (
      <section className="landing-stats" aria-label="QuizTime statistics">
        <div className="landing-stats-grid">
          {items.map((item, i) => (
            <div key={i} className="landing-stat-card">
              <div className="landing-stat-left">
                <span className="landing-stat-title">{item.label}</span>
              </div>
              <div className="landing-stat-right">
                <div className="landing-stat-skeleton" />
                <div className="landing-stat-subtext-skeleton" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!stats) return null;

  return (
    <section className="landing-stats" aria-label="QuizTime statistics">
      <div className="landing-stats-grid">
        {items.map((item, i) => (
          <article key={i} className="landing-stat-card">
            <div className="landing-stat-left">
              <h3 className="landing-stat-title">{item.label}</h3>
            </div>
            <div className="landing-stat-right">
              <p className="landing-stat-value">
                <AnimatedNumber value={item.value} />
              </p>
              <span className="landing-stat-subtext">{item.subtext}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LandingPage() {
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  const handleFlashcardClick = () => {
    setFlashcardFlipped(prev => !prev);
  };

  const handleFlashcardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFlashcardFlipped(prev => !prev);
    }
  };

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="QuizTime home">
          <Image
            className="landing-brand-logo"
            src="/images/logo.png"
            alt=""
            width={40}
            height={40}
            priority
          />
          <span>QuizTime</span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#how-it-works" className="landing-nav-link">How it works</a>
        </nav>
        <Link className="landing-signin" href="/login">Sign in</Link>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> YOUR NEXT STUDY SESSION STARTS HERE</p>
          <h1>Make studying feel like <span>progress.</span></h1>
          <p className="landing-hero-description">
            Turn your notes into a study plan that works for you. Make flashcards,
            test what you know, and keep the hard-to-remember details in reach.
          </p>
          <div className="landing-hero-actions">
            <Link className="landing-button landing-button-primary" href="/login">
              Get started <ArrowRight size={17} aria-hidden />
            </Link>
            <a className="landing-button landing-button-secondary" href="#features">
              Explore features <ArrowDown size={16} aria-hidden />
            </a>
          </div>
          <p className="landing-reassurance">Free to get started <span>·</span> Sign in with Google</p>
        </div>

        <div className="landing-preview" aria-label="Example QuizTime flashcard">
          <div className="landing-preview-glow" />
          <div className="landing-preview-note landing-preview-note-top">
            <span className="landing-note-icon"><Sparkles size={16} strokeWidth={2.5} aria-hidden /></span>
            <span><strong>One small session</strong><small>can make a big difference</small></span>
          </div>
          <div
            className={`landing-flashcard ${flashcardFlipped ? 'flipped' : ''}`}
            tabIndex={0}
            role="button"
            aria-label="Interactive flashcard demo - press to flip"
            aria-pressed={flashcardFlipped}
            onClick={handleFlashcardClick}
            onKeyDown={handleFlashcardKeyDown}
          >
            <div className="landing-flashcard-inner">
              <div className="landing-flashcard-front">
                <div className="landing-flashcard-top">
                  <span><BookOpenCheck size={15} strokeWidth={2.5} aria-hidden /> QUICK STUDY</span>
                  <span>01 / 12</span>
                </div>
                <div className="landing-flashcard-content">
                  <span className="landing-card-label">BIOLOGY · CELL DIVISION</span>
                  <h2>What are the four phases of mitosis?</h2>
                  <div className="landing-card-answer">
                    <span>Take a moment to think it through…</span>
                    <span className="landing-card-dots"><i /><i /><i /></span>
                  </div>
                </div>
                <div className="landing-flashcard-bottom">
                  <span><span className="landing-progress-dot" /> Keep your streak going</span>
                  <span className="landing-card-arrow"><ArrowRight size={16} aria-hidden /></span>
                </div>
              </div>
              <div className="landing-flashcard-back">
                <h3>Prophase, Metaphase, Anaphase, Telophase</h3>
                <p>PMAT - remember the order!</p>
              </div>
            </div>
          </div>
          <div className="landing-preview-note landing-preview-note-bottom">
            <span className="landing-streak-mark"><Star size={19} strokeWidth={2.5} aria-hidden /></span>
            <span><strong>Made for how you learn</strong><small>Cards · quizzes · spaced review</small></span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="landing-mascot" src="/hamster/hamster-wave.png" alt="QuizTime mascot waving" />
        </div>
      </section>

      <PublicStats />

      <div className="landing-proof-strip" aria-label="Study tools included">
        <span><BookOpenCheck size={17} strokeWidth={2.5} aria-hidden /> Flashcards from your notes</span>
        <span><Brain size={17} strokeWidth={2.5} aria-hidden /> Four ways to practice</span>
        <span><Sparkles size={17} strokeWidth={2.5} aria-hidden /> AI help when you need it</span>
      </div>

      <section className="landing-features" id="features">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">A LITTLE HELP GOES A LONG WAY</p>
          <h2>Everything you need to <span>study smarter.</span></h2>
          <p>From the first set of cards to the final review, your study tools work together.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, title, description, tone }) => (
            <article
              className={`landing-feature-card landing-feature-${tone}`}
              key={title}
              tabIndex={0}
              role="button"
              aria-label={`Learn about ${title}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
            >
              <span className="landing-feature-icon"><Icon size={21} aria-hidden /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-how-copy">
          <p className="landing-eyebrow">GET FROM NOTES TO KNOWING</p>
          <h2>Three steps. <span>One less thing to worry about.</span></h2>
          <p>Spend less time setting up and more time learning what matters.</p>
        </div>
        <ol className="landing-steps">
          <li>
            <span aria-hidden="true">01</span>
            <div><strong>Bring your material</strong><p>Upload a file, snap a photo, or paste your notes.</p></div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div><strong>Make it yours</strong><p>Review your flashcards and choose how you want to practice.</p></div>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <div><strong>Build it into memory</strong><p>Study a little at a time and let spaced review help you remember.</p></div>
          </li>
        </ol>
      </section>

      <section className="landing-cta">
        <span className="landing-cta-sparkle"><Sparkles size={20} aria-hidden /></span>
        <h2>Ready when you are.</h2>
        <p>Your next study session can start with the notes you already have.</p>
        <Link className="landing-button landing-button-primary" href="/login">
          Start studying <ArrowRight size={17} aria-hidden />
        </Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-brand" href="/" aria-label="QuizTime home">
          <Image
            className="landing-brand-logo"
            src="/images/logo.png"
            alt=""
            width={32}
            height={32}
          />
          <span>QuizTime</span>
        </Link>
        <p>Made for curious minds and one-card-at-a-time progress.</p>
        <span>© {new Date().getFullYear()} QuizTime</span>
      </footer>
      <div className="landing-footer-low">
        Developed by <strong>FBC BSIT 3-A</strong> · QuizTime © {new Date().getFullYear()}
      </div>
    </main>
  );
}
