import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * PrivacyPolicy.jsx
 * ------------------------------------------------------------------
 * Official Privacy Policy for Gesture Studio.
 * Owner: Lalith Srinivas
 * Contact: webryza@gmail.com
 * Domain: gesturestudio.in
 */

export default function PrivacyPolicy() {
  const topAnchorRef = useRef(null);

  useLayoutEffect(() => {
    document.title = 'Privacy Policy | Gesture Studio';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Privacy Policy for Gesture Studio. Learn how your account data, local camera tracking, and game scores are protected.'
      );
    }

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
              PRIVACY POLICY
            </span>
            <span className="font-mono text-xs font-bold text-zinc-500">
              LAST UPDATED: {lastUpdated}
            </span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-black mb-3 leading-none">
            YOUR DATA. YOUR CONTROL.
          </h1>

          <p className="text-zinc-700 text-sm sm:text-base font-medium leading-relaxed mb-4">
            Welcome to Gesture Studio (<strong className="text-black font-bold">gesturestudio.in</strong>). We believe in complete
            transparency, minimal data collection, and putting player control first. This Privacy Policy outlines
            exactly what information we collect, how it is processed, and how your privacy is safeguarded.
          </p>

          <div className="bg-neo-cream border-2 border-black p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold">
            <div>
              <span className="text-zinc-500 uppercase">Platform Owner:</span>{' '}
              <span className="text-black">Lalith Srinivas</span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase">Privacy Inquiries:</span>{' '}
              <a
                href="mailto:webryza@gmail.com"
                className="text-black underline hover:text-blue-700 transition-colors"
              >
                webryza@gmail.com
              </a>
            </div>
          </div>
        </section>

        {/* Policy Sections */}
        <div className="space-y-6">
          {/* Section 1: About Gesture Studio */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                1
              </span>
              <span>About Gesture Studio</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio is a browser-based gaming and interactive web application that enables players to enjoy
              arcade games (including Fruit Ninja, Crazy Road, Flappy Bird, Archery Challenge, Bird Hunter, and Space
              Shooter) using natural hand gestures via their webcam, as well as alternative keyboard and touch inputs.
            </p>
          </article>

          {/* Section 2: Information We Collect */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                2
              </span>
              <span>Information We Collect</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We collect and store only the data necessary to provide game functionality, persistent player progression,
              and leaderboard ranking. Based on your account type and interaction, this may include:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Account Information:</strong> Chosen username or display handle, email
                address (for registered email/password or Google accounts), and avatar emoji or Google profile image URL.
              </li>
              <li>
                <strong className="text-black">Authentication Metadata:</strong> Secure user identifier (UID) generated
                and managed via Firebase Authentication.
              </li>
              <li>
                <strong className="text-black">Game Scores &amp; Stats:</strong> Per-game high scores, games played, total
                play counts, and historical score records.
              </li>
              <li>
                <strong className="text-black">Progression Data:</strong> Experience points (XP), player level, unlocked
                achievements, daily login streak, gameplay streaks, and daily reward claim dates.
              </li>
              <li>
                <strong className="text-black">Preferences &amp; Tutorials:</strong> Sound on/off toggles and Gesture
                Academy / per-game tutorial completion status.
              </li>
            </ul>
            <div className="bg-zinc-100 border border-black/30 p-3 text-xs font-mono text-zinc-700">
              📌 Note: We do not collect government identification, physical addresses, billing details, or phone numbers.
            </div>
          </article>

          {/* Section 3: Authentication & Guest Accounts */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-cyan border border-black flex items-center justify-center text-xs font-mono">
                3
              </span>
              <span>Authentication &amp; Guest Accounts</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio supports three methods of authentication, all managed through Google Firebase
              Authentication:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Guest / Anonymous Mode:</strong> Allows immediate gameplay without
                providing an email address or password. Progression is tied to an anonymous Firebase account on your device.
              </li>
              <li>
                <strong className="text-black">Email &amp; Password:</strong> Handled securely by Firebase Authentication.
                Gesture Studio never sees or stores your raw plaintext password.
              </li>
              <li>
                <strong className="text-black">Google Sign-In:</strong> Facilitated via Google OAuth. Gesture Studio
                receives only your public display name, email address, and profile photo URL. We do not have access to
                your Google account password.
              </li>
            </ol>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Guest users can link their anonymous account to Google or an Email/Password account at any time from their
              Profile, ensuring that game scores, streaks, and XP are never lost.
            </p>
          </article>

          {/* Section 4: Camera & Hand Tracking (Important) */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-pink border border-black flex items-center justify-center text-xs font-mono">
                4
              </span>
              <span>Webcam &amp; Hand Tracking Privacy</span>
            </h2>
            <div className="bg-emerald-50 border-2 border-emerald-600 p-3.5 text-xs sm:text-sm font-mono text-emerald-900 font-bold mb-2">
              🔒 100% Client-Side Processing: Your camera feed never leaves your device.
            </div>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture-controlled games in Gesture Studio utilize your device's webcam to recognize hand motions. Here is
              exactly how this works:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Explicit Permission:</strong> Camera access is requested only when you
                launch a gesture-enabled game or the Gesture Academy. It requires your explicit browser permission.
              </li>
              <li>
                <strong className="text-black">Local Browser Computation:</strong> All video frames are processed in
                real time by Google MediaPipe Hands running entirely inside your local web browser (via WebAssembly and
                HTML5 Canvas).
              </li>
              <li>
                <strong className="text-black">No Recording or Uploading:</strong> Gesture Studio does not record, take
                snapshots, upload, stream, or permanently store video feeds or images of you or your surroundings on any
                server or database.
              </li>
              <li>
                <strong className="text-black">Real-Time Anime &amp; Stylization Filters:</strong> Live camera preview filters (such as our real-time anime cel-shaded camera effect) and motion skeleton overlays are processed entirely locally on your device's graphics hardware (via WebGL and HTML5 Canvas). No filtered video frames or facial/body imagery are ever uploaded or transmitted externally.
              </li>
              <li>
                <strong className="text-black">Revoking Access:</strong> You can deny or revoke camera permission at any
                time in your browser or device settings. All games provide alternative keyboard or touch controls.
              </li>
            </ul>
          </article>

          {/* Section 5: Firebase Infrastructure & No Analytics */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-purple border border-black flex items-center justify-center text-xs font-mono">
                5
              </span>
              <span>Firebase Infrastructure &amp; Analytics Notice</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio utilizes Google Firebase cloud services solely for backend infrastructure:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Firebase Authentication:</strong> Manages account login state and credentials.
              </li>
              <li>
                <strong className="text-black">Cloud Firestore:</strong> Stores structured player profiles, high scores,
                gameplay statistics, and community leaderboards.
              </li>
            </ul>
            <div className="bg-neo-yellow/30 border-2 border-black p-3 text-xs sm:text-sm font-mono text-black font-bold">
              🚫 No Analytics Tracking: Gesture Studio does NOT integrate Google Analytics, Firebase Analytics, tracking
              pixels, session recording tools, or third-party telemetry. We do not track your browsing habits outside our
              application.
            </div>
          </article>

          {/* Section 6: Leaderboards & Public Information */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-orange border border-black flex items-center justify-center text-xs font-mono">
                6
              </span>
              <span>Scores, Progression &amp; Leaderboards</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Game scores, levels, XP, and achievements may be published to Gesture Studio's public leaderboards. Publicly
              visible information is strictly limited to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-zinc-800 pl-2">
              <li>Your chosen player username (or guest handle, e.g., Guest_4821)</li>
              <li>Your selected avatar icon</li>
              <li>Your player level and game high scores</li>
            </ul>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed font-semibold">
              Your private email address and personal account credentials are NEVER published or exposed on any public
              leaderboard or leaderboard API.
            </p>
          </article>

          {/* Section 7: Browser Storage */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                7
              </span>
              <span>Browser Storage (Local &amp; Session)</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio uses your browser's local storage (<code className="bg-zinc-100 px-1 border border-black/20 text-xs">localStorage</code>)
              for performance optimization and offline continuity. This includes:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm sm:text-base text-zinc-800 pl-2">
              <li>Caching high scores and sound preferences so games load instantaneously</li>
              <li>Remembering tutorial completion status so you are not forced through repeated onboarding</li>
              <li>Maintaining local user session identifiers between visits</li>
            </ul>
            <p className="text-zinc-700 text-xs sm:text-sm font-medium">
              We do not use tracking cookies for marketing or profiling. You may clear your browser's local storage at any
              time via your browser settings.
            </p>
          </article>

          {/* Section 8: Advertising (Future) */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                8
              </span>
              <span>Future Advertising &amp; Third Parties</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio does not currently run live commercial advertisements. However, the platform layout is designed
              to support third-party advertising in the future (such as Google AdSense and HTML5 game ad networks) to help
              sustain free gaming.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              When advertising is actively enabled in the future, this Privacy Policy will be promptly updated to provide
              detailed disclosures regarding advertising cookies (including Google DART cookies), personalized versus
              non-personalized ad preferences, and relevant opt-out tools.
            </p>
          </article>

          {/* Section 9: Third-Party Service Providers */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-cyan border border-black flex items-center justify-center text-xs font-mono">
                9
              </span>
              <span>Third-Party Services</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We rely on trusted third-party providers to host and operate the platform:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">Google Firebase:</strong> Cloud database, hosting storage, and authentication.
              </li>
              <li>
                <strong className="text-black">Vercel Inc.:</strong> Web application hosting, static asset delivery, and CDN.
              </li>
              <li>
                <strong className="text-black">Google MediaPipe &amp; JSDelivr CDN:</strong> Delivery of client-side computer
                vision hand-tracking libraries.
              </li>
            </ul>
          </article>

          {/* Section 10: Data Security & Retention */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-pink border border-black flex items-center justify-center text-xs font-mono">
                10
              </span>
              <span>Data Security &amp; Retention</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We apply commercially reasonable technical safeguards, including HTTPS protocol encryption, database security
              rules, and client-side processing, to protect your data. While we strive to protect your information, no
              Internet transmission is 100% secure, and we cannot warrant absolute security.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We retain account and gameplay data for as long as necessary to maintain your player profile, leaderboard
              records, and game progress, or until you request account deletion.
            </p>
          </article>

          {/* Section 11: User Rights & Deletion Requests */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-purple border border-black flex items-center justify-center text-xs font-mono">
                11
              </span>
              <span>Your Privacy Rights &amp; Data Requests</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              You have the right to request access to the information associated with your account, correct your display
              username, or request the complete deletion of your account and related leaderboard entries.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              To submit a privacy inquiry or account deletion request, email us directly at{' '}
              <a
                href="mailto:webryza@gmail.com"
                className="font-bold underline text-black hover:text-blue-700 transition-colors"
              >
                webryza@gmail.com
              </a>{' '}
              with the subject line <code className="bg-zinc-100 px-1 border border-black/20 text-xs">Privacy Request</code>.
              We will process your request promptly.
            </p>
          </article>

          {/* Section 12: Age & Children's Privacy */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-orange border border-black flex items-center justify-center text-xs font-mono">
                12
              </span>
              <span>Age Guidelines &amp; Children</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio is a general-audience web gaming platform and is not specifically directed to children under
              the age of 13. We do not knowingly collect unnecessary personal information from children. If you believe a
              minor has provided personal data without parental consent, please contact us so we can immediately remove the
              information.
            </p>
          </article>

          {/* Section 13: Changes to This Policy */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-yellow border border-black flex items-center justify-center text-xs font-mono">
                13
              </span>
              <span>Changes to This Privacy Policy</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We may update this Privacy Policy from time to time to reflect modifications in our game features, third-party
              services, or applicable legal standards. Any revisions will be reflected with an updated "Last Updated" date at
              the top of this page.
            </p>
          </article>

          {/* Section 14: Contact Information */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-3">
            <h2 className="font-display font-black text-lg sm:text-xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-neo-lime border border-black flex items-center justify-center text-xs font-mono">
                14
              </span>
              <span>Contact Information</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              If you have any questions, concerns, or requests regarding this Privacy Policy or how your data is handled in
              Gesture Studio, please contact:
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

        {/* Action Link to Terms of Use */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border-3 border-black shadow-neo p-5">
          <div>
            <p className="font-display font-black text-base uppercase">Looking for our rules &amp; service conditions?</p>
            <p className="text-xs font-mono text-zinc-600 font-medium">
              Read our full Terms of Use governing gameplay and accounts.
            </p>
          </div>
          <Link
            to="/terms"
            onClick={() => {
              window.scrollTo(0, 0);
              const r = document.getElementById('root');
              if (r) r.scrollTop = 0;
            }}
            className="neo-btn bg-neo-yellow hover:bg-yellow-300 text-black px-4 py-2 text-xs font-black shrink-0"
          >
            VIEW TERMS OF USE ➔
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
          className="text-black underline font-extrabold"
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
          className="hover:text-black hover:underline transition-colors"
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

