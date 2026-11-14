import React, { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * AboutPage.jsx
 * Comprehensive about and technological breakdown of Gesture Studio.
 * Enhances publisher transparency, E-E-A-T, and content depth for Google AdSense.
 */
export default function AboutPage() {
  const topAnchorRef = useRef(null);

  useLayoutEffect(() => {
    document.title = 'About Gesture Studio | Vision AI Browser Gaming Platform';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Learn about Gesture Studio: our mission, real-time MediaPipe hand tracking technology, privacy-first on-device AI vision, and creator Lalith Srinivas.'
      );
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://www.gesturestudio.in/about');

    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-neo-dots text-black font-sans selection:bg-neo-yellow selection:text-black flex flex-col pb-24 md:pb-16">
      <div ref={topAnchorRef} tabIndex={-1} aria-hidden="true" className="absolute top-0 left-0 w-0 h-0 pointer-events-none opacity-0" />

      {/* ── Top Header Navigation ────────────────────────────────────────── */}
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
          ABOUT PLATFORM
        </span>
      </header>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[920px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Banner */}
        <section className="bg-white border-3 md:border-4 border-black shadow-neo-lg p-6 sm:p-8 mb-8 relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="neo-tag bg-neo-yellow text-black border-2 border-black font-black text-[10px] uppercase">
              ABOUT US
            </span>
            <span className="neo-tag bg-neo-lime text-black border-2 border-black font-mono text-[10px] uppercase">
              TOUCHLESS REVOLUTION
            </span>
            <span className="neo-tag bg-neo-cyan text-black border-2 border-black font-mono text-[10px] uppercase">
              100% WEB-BASED
            </span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl uppercase tracking-tight text-black mb-4 leading-none">
            REIMAGINING ARCADE GAMING THROUGH VISION AI
          </h1>

          <p className="text-zinc-800 text-base sm:text-lg font-medium leading-relaxed mb-6">
            Gesture Studio (<strong className="text-black font-bold">www.gesturestudio.in</strong>) is an open-access, browser-powered gaming platform engineered by Lalith Srinivas. We harness state-of-the-art computer vision to turn standard consumer webcams into high-precision, low-latency motion controllers—without requiring specialized hardware, downloads, or third-party sensor peripherals.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neo-cream border-2 border-black p-4 text-center">
            <div>
              <div className="font-display font-black text-2xl sm:text-3xl text-black">7+</div>
              <div className="font-mono text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Interactive Games</div>
            </div>
            <div>
              <div className="font-display font-black text-2xl sm:text-3xl text-black">21</div>
              <div className="font-mono text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Hand Landmarks</div>
            </div>
            <div>
              <div className="font-display font-black text-2xl sm:text-3xl text-black">60 FPS</div>
              <div className="font-mono text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Real-Time Speed</div>
            </div>
            <div>
              <div className="font-display font-black text-2xl sm:text-3xl text-black">0 MB</div>
              <div className="font-mono text-[10px] sm:text-xs font-bold text-zinc-600 uppercase">Hardware Install</div>
            </div>
          </div>
        </section>

        {/* Section 1: The Origin & Mission */}
        <div className="space-y-6">
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-4">
            <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2.5">
              <span className="w-7 h-7 bg-neo-yellow border-2 border-black flex items-center justify-center text-sm font-mono font-bold">
                1
              </span>
              <span>Our Story &amp; Purpose</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              For decades, motion-controlled interactive entertainment was gatekept by expensive console accessories: depth-sensing bars, IR wands, and tethered VR rigs. The core mission of Gesture Studio is democratizing motion gaming: providing high-octane, controller-free entertainment straight in Google Chrome, Microsoft Edge, Mozilla Firefox, and Apple Safari with instant one-click accessibility.
            </p>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Every title on Gesture Studio is built from the ground up for instantaneous engagement. Players can slice flying fruits with finger strikes, pilot galactic starships through enemy formations, weave through three-lane highway traffic, flap through perilous pipes, and challenge friends to 1v1 aerial archery duels using natural hand gestures.
            </p>
          </article>

          {/* Section 2: Technology Deep Dive */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-4">
            <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2.5">
              <span className="w-7 h-7 bg-neo-lime border-2 border-black flex items-center justify-center text-sm font-mono font-bold">
                2
              </span>
              <span>The Technology Behind The Magic</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio merges cutting-edge open web standards into a seamless, high-performance runtime:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 border-2 border-black bg-zinc-50 shadow-neo-xs space-y-1.5">
                <div className="font-display font-black text-base uppercase text-black flex items-center gap-2">
                  <span>🤖</span>
                  <span>Google MediaPipe Vision AI</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                  Deep neural networks extract 21 3-dimensional Cartesian coordinates for wrist, knuckles, joints, and fingertips directly from optical webcam video streams, accurately identifying pinches, closed fists, peace signs, and pointing gestures.
                </p>
              </div>

              <div className="p-4 border-2 border-black bg-zinc-50 shadow-neo-xs space-y-1.5">
                <div className="font-display font-black text-base uppercase text-black flex items-center gap-2">
                  <span>⚡</span>
                  <span>WebAssembly &amp; WebGL Acceleration</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                  Machine learning model inference is compiled down to high-efficiency WebAssembly (WASM). Live video filtering, including our custom real-time anime cel-shaded camera effect, runs directly on your device GPU via WebGL shaders.
                </p>
              </div>

              <div className="p-4 border-2 border-black bg-zinc-50 shadow-neo-xs space-y-1.5">
                <div className="font-display font-black text-base uppercase text-black flex items-center gap-2">
                  <span>🎵</span>
                  <span>Procedural Web Audio API</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                  Zero static audio bloat. Dynamic blade whooshes, slingshot snaps, celebratory fanfares, and 8-bit retro countdowns are synthesized in real time on the browser's audio thread for zero-latency auditory feedback.
                </p>
              </div>

              <div className="p-4 border-2 border-black bg-zinc-50 shadow-neo-xs space-y-1.5">
                <div className="font-display font-black text-base uppercase text-black flex items-center gap-2">
                  <span>🌐</span>
                  <span>Real-Time WebSocket Arena</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                  Multiplayer duel modes (such as Stickman Showdown and Fruit Slash 1v1) exchange sub-50ms synchronized game payloads, allowing cross-platform real-time matches between PC, Mac, and mobile players worldwide.
                </p>
              </div>
            </div>
          </article>

          {/* Section 3: Privacy by Design */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-4">
            <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2.5">
              <span className="w-7 h-7 bg-neo-cyan border-2 border-black flex items-center justify-center text-sm font-mono font-bold">
                3
              </span>
              <span>100% Client-Side Privacy Guarantee</span>
            </h2>
            <div className="bg-emerald-50 border-2 border-emerald-600 p-3.5 text-xs sm:text-sm font-mono text-emerald-900 font-bold">
              🔒 Privacy First: Your camera video stream never leaves your physical device.
            </div>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              We hold a foundational belief that user privacy must never be compromised for novelty. When you grant camera permission on Gesture Studio:
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm sm:text-base text-zinc-800 pl-2">
              <li>
                <strong className="text-black">No Video Uploads:</strong> Video frames are ingested into a local in-memory HTML5 video element and passed exclusively to the local MediaPipe WASM runtime.
              </li>
              <li>
                <strong className="text-black">Zero Server Streaming:</strong> Gesture Studio has zero backend streaming pipelines, video recording endpoints, or frame storage servers.
              </li>
              <li>
                <strong className="text-black">Instant Revocation:</strong> You can revoke camera permission at any point in your browser address bar. Every game offers full alternative keyboard or touch controls.
              </li>
            </ul>
          </article>

          {/* Section 4: System Requirements & Setup Recommendations */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-4">
            <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2.5">
              <span className="w-7 h-7 bg-neo-pink border-2 border-black flex items-center justify-center text-sm font-mono font-bold">
                4
              </span>
              <span>System &amp; Environment Setup</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              For the best tracking precision and lowest input latency, we recommend following these simple setup tips:
            </p>
            <div className="space-y-3 pt-1">
              <div className="p-3 bg-zinc-50 border border-black/30 text-xs sm:text-sm">
                <strong className="font-mono uppercase text-black block mb-0.5">💡 Room Lighting:</strong>
                Ensure your hand is illuminated from the front. Avoid intense backlighting (like sitting with your back directly against a sunlit window), which creates silhouettes.
              </div>
              <div className="p-3 bg-zinc-50 border border-black/30 text-xs sm:text-sm">
                <strong className="font-mono uppercase text-black block mb-0.5">📏 Distance from Camera:</strong>
                Position yourself 1.5 to 3 feet (0.5 to 1 meter) from your webcam so your entire hand is clearly in view of the frame.
              </div>
              <div className="p-3 bg-zinc-50 border border-black/30 text-xs sm:text-sm">
                <strong className="font-mono uppercase text-black block mb-0.5">💻 Supported Browsers:</strong>
                Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Opera) deliver optimal WebAssembly SIMD execution. Modern Apple Safari and Mozilla Firefox are fully supported.
              </div>
            </div>
          </article>

          {/* Section 5: Editorial & Creator Information */}
          <article className="bg-white border-3 border-black shadow-neo p-5 sm:p-7 space-y-4">
            <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight border-b-2 border-black/15 pb-2 flex items-center gap-2.5">
              <span className="w-7 h-7 bg-neo-purple border-2 border-black flex items-center justify-center text-sm font-mono font-bold">
                5
              </span>
              <span>Leadership &amp; Publisher Contact</span>
            </h2>
            <p className="text-zinc-800 text-sm sm:text-base leading-relaxed">
              Gesture Studio is independently designed, developed, and maintained by <strong>Lalith Srinivas</strong>, dedicated to building responsive, accessible web gaming applications.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/contact"
                className="neo-btn-primary px-5 py-2.5 text-xs uppercase font-mono tracking-wider"
              >
                ✉️ Contact Team
              </Link>
              <Link
                to="/privacy-policy"
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-black border-2 border-black font-mono font-black text-xs uppercase shadow-neo-xs"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="px-4 py-2 bg-white hover:bg-zinc-100 text-black border-2 border-black font-mono font-black text-xs uppercase shadow-neo-xs"
              >
                Terms of Use
              </Link>
            </div>
          </article>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-12 text-center text-xs font-mono font-bold text-zinc-600 flex flex-wrap items-center justify-center gap-4 select-none px-4">
        <div className="flex items-center gap-2">
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>GESTURE STUDIO</span>
        </div>
        <span>•</span>
        <Link to="/about" className="text-black font-black hover:underline">
          ABOUT US
        </Link>
        <span>•</span>
        <Link to="/contact" className="hover:text-black hover:underline">
          CONTACT US
        </Link>
        <span>•</span>
        <Link to="/privacy-policy" className="hover:text-black hover:underline">
          PRIVACY POLICY
        </Link>
        <span>•</span>
        <Link to="/terms" className="hover:text-black hover:underline">
          TERMS OF USE
        </Link>
      </footer>
    </div>
  );
}

