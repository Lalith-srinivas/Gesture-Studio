import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * Terms.jsx
 * ------------------------------------------------------------------
 * Official Terms of Use for Gesture Studio.
 * Owner: Lalith Srinivas
 * Contact: webryza@gmail.com
 * Domain: gesturestudio.in
 */

export default function Terms() {
  const topAnchorRef = useRef(null);

  useLayoutEffect(() => {
    document.title = 'Terms of Use | Gesture Studio';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Terms of Use for Gesture Studio. Read our rules of play, account guidelines, acceptable use policies, and legal terms.'
      );
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://www.gesturestudio.in/terms');

    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const scrollToTop = () => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      const root = document.getElementById('root');
      if (root) root.scrollTop = 0;
      topAnchorRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
    };

    scrollToTop();
    const raf = requestAnimationFrame(scrollToTop);
    const t1 = setTimeout(scrollToTop, 0);
    const t2 = setTimeout(scrollToTop, 60);
    const t3 = setTimeout(scrollToTop, 180);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const lastUpdated = 'September 18, 2026';

  return (
    <div className="relative w-full min-h-screen bg-neo-dots text-black font-sans selection:bg-neo-yellow selection:text-black flex flex-col pb-28 md:pb-16">
      {/* Absolute top anchor to force scrollIntoView to the beginning */}
      <div ref={topAnchorRef} tabIndex={-1} aria-hidden="true" className="absolute top-0 left-0 w-0 h-0 pointer-events-none opacity-0" />

      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 w-full bg-neo-yellow border-b-3 border-black shadow-neo-sm flex items-center justify-between px-4 py-2.5">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono font-black text-xs uppercase hover:underline transition-transform active:translate-x-0.5"
          aria-label="Return to Gesture Studio home"
        >
          <img src="/gesturestudio.png" alt="Gesture Studio Logo" className="w-6 h-6 object-contain" />
          <span>← BACK TO HOME</span>
        </Link>
        <span className="font-mono font-black text-[11px] sm:text-xs uppercase tracking-wider bg-black text-white px-2.5 py-1 border border-black shadow-neo-xs">
          LEGAL CENTER
        </span>
      </header>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[850px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Card */}
        <section className="bg-white border-3 md:border-4 border-black shadow-neo-lg p-6 sm:p-8 mb-8 relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="neo-tag bg-neo-yellow text-black border-2 border-black font-black text-[10px] uppercase">
              TERMS OF USE
            </span>
            <span className="font-mono text-xs font-bold text-zinc-500">
              LAST UPDATED: {lastUpdated}
            </span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-black mb-3 leading-none">
            THE RULES OF THE GAME
          </h1>

          <p className="text-zinc-700 text-sm sm:text-base font-medium leading-relaxed mb-4">
            These Terms of Use govern your access to and use of Gesture Studio (available at{' '}
            <strong className="text-black font-bold">gesturestudio.in</strong>). By playing our games or
            creating an account, you agree to comply with these terms.
          </p>

          <div className="bg-neo-cream border-2 border-black p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold">
            <div>
              <span className="text-zinc-500 uppercase">Platform Owner:</span>{' '}
              <span className="text-black">Lalith Srinivas</span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase">Contact Email:</span>{' '}
              <a
                href="mailto:webryza@gmail.com"
                className="text-black underline hover:text-blue-700 transition-colors"
              >
                webryza@gmail.com
              </a>
            </div>
          </div>
        </section>

        {/* Terms Sections */}
        <div className="space-y-6">
          {/* 1. Acceptance of Terms */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                1
              </span>
              <span>Acceptance of Terms</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              By visiting, browsing, playing, or otherwise accessing Gesture Studio, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Use and our accompanying{' '}
              <Link
                to="/privacy-policy"
                onClick={() => {
                  window.scrollTo(0, 0);
                  const r = document.getElementById('root');
                  if (r) r.scrollTop = 0;
                }}
                className="font-bold underline hover:text-blue-700 transition-colors"
              >
                Privacy Policy
              </Link>
              . If you do not agree to these terms, please do not use the service.
            </p>
          </article>

          {/* 2. Description of Service */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                2
              </span>
              <span>Description of Service</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio provides an interactive web gaming hub featuring browser-based arcade titles including Fruit
              Ninja, Crazy Road, Flappy Bird, Archery Challenge, Bird Hunter, and Space Shooter, along with the Gesture
              Academy tutorial experience. The platform supports interactive webcam-based hand tracking as well as
              standard keyboard and touch controls.
            </p>
          </article>

          {/* 3. Accounts & Registration */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-cyan border border-black flex items-center justify-center text-xs font-mono">
                3
              </span>
              <span>Player Accounts</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio provides flexible access options:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Guest Accounts:</strong> Users may play instantly as guests. Gameplay
                records and high scores are tracked through anonymous authentication.
              </li>
              <li>
                <strong className="text-black">Registered Accounts:</strong> Users may register using Email/Password or
                authenticate via Google Sign-In to preserve their achievements, streaks, and ranking across different devices.
              </li>
              <li>
                <strong className="text-black">Account Security:</strong> You are responsible for maintaining the
                confidentiality of your login credentials and for all activities that occur under your account.
              </li>
            </ul>
          </article>

          {/* 4. Acceptable Use */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-pink border border-black flex items-center justify-center text-xs font-mono">
                4
              </span>
              <span>Acceptable Use &amp; Fair Play</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              To ensure a fun, safe, and fair gaming environment for all players, you agree that you will not:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-zinc-800 pl-2">
              <li>Intentionally disrupt, overload, or impair the service or its underlying infrastructure.</li>
              <li>Attempt unauthorized access to other players' accounts, database collections, or hosting environments.</li>
              <li>Exploit software vulnerabilities, bugs, or glitches to gain an unfair advantage.</li>
              <li>Introduce malicious scripts, viruses, automated bots, or scrapers.</li>
              <li>Choose offensive, abusive, defamatory, or unlawful player usernames.</li>
            </ul>
          </article>

          {/* 5. Scores and Leaderboards */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-purple border border-black flex items-center justify-center text-xs font-mono">
                5
              </span>
              <span>Scores, Progression &amp; Leaderboards</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Game scores, experience points (XP), player levels, and leaderboard positions must be earned through
              genuine, unassisted player gameplay.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Tampering with client memory, sending forged score payloads, or manipulating leaderboard database records is
              strictly prohibited. Gesture Studio reserves the right to audit, recalculate, disqualify, or delete any
              scores or leaderboard entries that are determined to be fraudulent, invalid, or achieved through exploitation.
            </p>
          </article>

          {/* 6. Camera Permission */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-orange border border-black flex items-center justify-center text-xs font-mono">
                6
              </span>
              <span>Camera Permission &amp; Hardware</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Certain games and navigation controls offer optional webcam hand-tracking and real-time anime-stylized visual camera previews. Granting camera access is entirely voluntary and requires explicit permission in your browser. All vision processing and real-time visual stylization filters occur strictly client-side within your own browser without uploading, broadcasting, or recording video feeds.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              You are responsible for your own hardware, webcam compatibility, adequate lighting conditions, and physical
              surroundings while interacting with gesture games.
            </p>
          </article>

          {/* 7. Service Availability */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                7
              </span>
              <span>Service Availability &amp; Modifications</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio is provided on an "as is" and "as available" basis. We do not guarantee that the service will
              be completely uninterrupted, timely, or error-free.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              The service may experience downtime due to maintenance, hosting outages, browser compatibility updates, or
              bug fixes. We reserve the right to modify, balance, update, or discontinue any game mode or feature at any
              time without prior notice.
            </p>
          </article>

          {/* 8. Third-Party Services */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                8
              </span>
              <span>Third-Party Services</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio relies on third-party services and infrastructure, including Google Firebase, Vercel Inc.,
              and JSDelivr CDN. Your interaction with these components may also be subject to those providers' respective
              terms of service and privacy policies.
            </p>
          </article>

          {/* 9. Advertising (Future) */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-cyan border border-black flex items-center justify-center text-xs font-mono">
                9
              </span>
              <span>Advertising Policy</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              To support free access to our games, Gesture Studio is designed to accommodate third-party advertisements
              (such as Google AdSense and HTML5 game ad networks) in the future.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              While active advertisements are not currently integrated, you acknowledge that future advertisements may be
              served in designated, non-intrusive container slots without compromising the core gameplay interface.
            </p>
          </article>

          {/* 10. Intellectual Property */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-pink border border-black flex items-center justify-center text-xs font-mono">
                10
              </span>
              <span>Intellectual Property</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              The original Gesture Studio name, brand logos, graphical user interface, original custom code, game logic,
              and design elements are the proprietary intellectual property of Lalith Srinivas and Gesture Studio.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio incorporates third-party open-source libraries (including React, Google MediaPipe, Tailwind
              CSS, Matter.js, and Framer Motion). All trademarks, copyrights, and intellectual property rights in these
              external libraries remain with their respective copyright holders under their applicable open-source licenses.
            </p>
          </article>

          {/* 11. Disclaimer of Warranties */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-purple border border-black flex items-center justify-center text-xs font-mono">
                11
              </span>
              <span>Disclaimer of Warranties</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              To the fullest extent permitted by applicable law, Gesture Studio is provided without warranties of any
              kind, whether express, implied, statutory, or otherwise, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, non-infringement, or accuracy of hand gesture tracking.
            </p>
          </article>

          {/* 12. Limitation of Liability */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-orange border border-black flex items-center justify-center text-xs font-mono">
                12
              </span>
              <span>Limitation of Liability</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              To the maximum extent permitted by applicable law, Lalith Srinivas and Gesture Studio shall not be liable
              for any indirect, incidental, special, consequential, or punitive damages, including loss of data, scores,
              goodwill, or device interruption, arising from or related to your use of or inability to use the platform.
            </p>
          </article>

          {/* 13. Changes to These Terms */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                13
              </span>
              <span>Changes to Terms</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We reserve the right to revise these Terms of Use at any time. Changes become effective immediately upon
              posting with an updated "Last Updated" date. Your continued access to or use of Gesture Studio after any
              modifications constitutes your acceptance of the updated terms.
            </p>
          </article>

          {/* 14. Contact Information */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                14
              </span>
              <span>Contact Information</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              If you have any questions or feedback concerning these Terms of Use, please reach out to us at:
            </p>
            <div className="bg-neo-cream border-2 border-black p-4 font-mono text-sm space-y-1">
              <p className="font-bold text-black">Lalith Srinivas</p>
              <p className="text-zinc-700">Gesture Studio</p>
              <p className="text-zinc-700">
                Email:{' '}
                <a
                  href="mailto:webryza@gmail.com"
                  className="font-bold underline text-black hover:text-blue-700 transition-colors"
                >
                  webryza@gmail.com
                </a>
              </p>
              <p className="text-zinc-700">Website: gesturestudio.in</p>
            </div>
          </article>
        </div>

        {/* Action Link to Privacy Policy */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-3 border-black shadow-neo p-5">
          <div>
            <p className="font-display font-black text-base uppercase">Curious about how we protect your data?</p>
            <p className="text-xs font-mono text-zinc-600 font-medium">
              Read our full Privacy Policy on local camera processing and security.
            </p>
          </div>
          <Link
            to="/privacy-policy"
            onClick={() => {
              window.scrollTo(0, 0);
              const r = document.getElementById('root');
              if (r) r.scrollTop = 0;
            }}
            className="neo-btn bg-neo-yellow hover:bg-yellow-300 text-black px-4 py-2 text-xs font-black shrink-0"
          >
            VIEW PRIVACY POLICY ➔
          </Link>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mt-12 text-center text-xs font-mono font-bold text-zinc-600 flex flex-wrap items-center justify-center gap-4 px-4 select-none">
        <Link
          to="/"
          onClick={() => {
            window.scrollTo(0, 0);
            const r = document.getElementById('root');
            if (r) r.scrollTop = 0;
          }}
          className="flex items-center gap-2 hover:text-black transition-colors"
        >
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>GESTURE STUDIO</span>
        </Link>
        <span>•</span>
        <Link
          to="/privacy-policy"
          onClick={() => {
            window.scrollTo(0, 0);
            const r = document.getElementById('root');
            if (r) r.scrollTop = 0;
          }}
          className="hover:text-black hover:underline transition-colors"
        >
          PRIVACY POLICY
        </Link>
        <span>•</span>
        <Link
          to="/terms"
          onClick={() => {
            window.scrollTo(0, 0);
            const r = document.getElementById('root');
            if (r) r.scrollTop = 0;
          }}
          className="text-black underline font-extrabold"
        >
          TERMS OF USE
        </Link>
        <span>•</span>
        <span>BUILT WITH REACT 19 &amp; TAILWIND</span>
        <span>•</span>
        <span>POWERED BY MEDIAPIPE</span>
      </footer>
    </div>
  );
}

