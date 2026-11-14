import React, { useState, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * ContactPage.jsx
 * Official Contact & Support portal for Gesture Studio.
 * Provides direct publisher communications, support inquiries, and bug reports.
 */
export default function ContactPage() {
  const topAnchorRef = useRef(null);
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'general', message: '' });
  const [submitted, setSubmitted] = useState(false);

  useLayoutEffect(() => {
    document.title = 'Contact Us | Gesture Studio Support & Feedback';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Contact Gesture Studio support, submit feedback, report bugs, or reach platform owner Lalith Srinivas.'
      );
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', 'https://www.gesturestudio.in/contact');

    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
  };

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
          SUPPORT DESK
        </span>
      </header>

      {/* ── Main Content Container ───────────────────────────────────── */}
      <main className="flex-1 w-full max-w-[880px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Banner */}
        <section className="bg-white border-3 md:border-4 border-black shadow-neo-lg p-6 sm:p-8 mb-8 relative">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="neo-tag bg-neo-yellow text-black border-2 border-black font-black text-[10px] uppercase">
              HELP &amp; INQUIRIES
            </span>
            <span className="neo-tag bg-neo-lime text-black border-2 border-black font-mono text-[10px] uppercase">
              DIRECT DEVELOPER ACCESS
            </span>
          </div>

          <h1 className="font-display font-black text-3xl sm:text-5xl uppercase tracking-tight text-black mb-3 leading-none">
            GET IN TOUCH WITH GESTURE STUDIO
          </h1>

          <p className="text-zinc-800 text-sm sm:text-base font-medium leading-relaxed mb-6">
            Have a question regarding webcam gesture tracking, want to report a gameplay bug, suggest a new game idea, or discuss business partnerships? We are here to help.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neo-cream border-2 border-black p-4 text-xs font-mono font-bold">
            <div>
              <span className="text-zinc-500 uppercase block text-[10px]">Lead Developer:</span>
              <span className="text-black text-sm">Lalith Srinivas</span>
            </div>
            <div>
              <span className="text-zinc-500 uppercase block text-[10px]">Direct Email:</span>
              <a href="mailto:webryza@gmail.com" className="text-black underline text-sm hover:text-blue-700">
                webryza@gmail.com
              </a>
            </div>
            <div>
              <span className="text-zinc-500 uppercase block text-[10px]">Response Window:</span>
              <span className="text-black text-sm">Within 24–48 Hours</span>
            </div>
          </div>
        </section>

        {/* Contact Form & Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left Form: 3 cols */}
          <div className="md:col-span-3 bg-white border-3 border-black shadow-neo p-5 sm:p-7">
            <h2 className="font-display font-black text-xl uppercase tracking-tight mb-4 flex items-center gap-2">
              <span>✉️</span>
              <span>Send Us a Message</span>
            </h2>

            {submitted ? (
              <div className="bg-neo-lime/30 border-2 border-black p-6 text-center space-y-3">
                <div className="text-4xl">🎉</div>
                <h3 className="font-display font-black text-xl uppercase text-black">
                  MESSAGE RECEIVED!
                </h3>
                <p className="text-xs sm:text-sm text-zinc-800 font-mono">
                  Thank you for reaching out, <strong>{formData.name}</strong>. We have logged your submission and will get back to you at <strong>{formData.email}</strong> shortly.
                </p>
                <div className="pt-2">
                  <a
                    href={`mailto:webryza@gmail.com?subject=[${encodeURIComponent(formData.subject)}] Message from ${encodeURIComponent(formData.name)}&body=${encodeURIComponent(formData.message)}`}
                    className="inline-block px-4 py-2 bg-black text-white font-mono font-bold text-xs uppercase shadow-neo-xs hover:bg-zinc-800"
                  >
                    Open in Mail Client
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs font-black uppercase text-zinc-700 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Alex Hunter"
                    className="w-full p-2.5 bg-zinc-50 border-2 border-black font-sans text-sm outline-none focus:bg-white focus:border-neo-yellow"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-zinc-700 mb-1">
                    Your Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="alex@example.com"
                    className="w-full p-2.5 bg-zinc-50 border-2 border-black font-sans text-sm outline-none focus:bg-white focus:border-neo-yellow"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-zinc-700 mb-1">
                    Inquiry Topic
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full p-2.5 bg-zinc-50 border-2 border-black font-sans text-sm outline-none focus:bg-white"
                  >
                    <option value="general">General Feedback &amp; Suggestions</option>
                    <option value="bug">Camera / Tracking Bug Report</option>
                    <option value="partnership">Business &amp; Sponsorship Inquiries</option>
                    <option value="privacy">Privacy &amp; Data Rights Request</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-zinc-700 mb-1">
                    Message Details *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your question, setup details, or feedback..."
                    className="w-full p-2.5 bg-zinc-50 border-2 border-black font-sans text-sm outline-none focus:bg-white resize-y"
                  />
                </div>

                <button
                  type="submit"
                  className="neo-btn-primary w-full py-3 text-xs uppercase font-mono tracking-wider flex items-center justify-center gap-2"
                >
                  <span>SUBMIT INQUIRY</span>
                  <span>➔</span>
                </button>
              </form>
            )}
          </div>

          {/* Right Info: 2 cols */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white border-3 border-black shadow-neo p-5 space-y-3">
              <h3 className="font-display font-black text-lg uppercase tracking-tight text-black flex items-center gap-2">
                <span>⚡</span>
                <span>Quick Resolution</span>
              </h3>
              <p className="text-xs text-zinc-700 leading-relaxed">
                Most camera detection issues can be solved in seconds:
              </p>
              <ul className="text-xs text-zinc-800 space-y-2 pl-3 border-l-2 border-neo-yellow">
                <li>Check that camera permissions are enabled in your browser URL lock icon.</li>
                <li>Ensure face-forward lighting so your hand is clearly illuminated.</li>
                <li>Close other software (like Zoom or Teams) that may lock webcam hardware.</li>
              </ul>
            </div>

            <div className="bg-neo-yellow border-3 border-black shadow-neo p-5 space-y-2">
              <h3 className="font-display font-black text-lg uppercase tracking-tight text-black">
                Privacy Inquiries
              </h3>
              <p className="text-xs text-black font-medium leading-relaxed">
                For data access, account deletion, or questions regarding Google AdSense cookies and local MediaPipe processing, please consult our full disclosure:
              </p>
              <Link
                to="/privacy-policy"
                className="inline-block mt-1 font-mono font-black text-xs uppercase underline hover:text-blue-900"
              >
                Read Privacy Policy ➔
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-12 text-center text-xs font-mono font-bold text-zinc-600 flex flex-wrap items-center justify-center gap-4 select-none px-4">
        <div className="flex items-center gap-2">
          <img src="/gesturestudio.png" alt="Gesture Studio" className="w-5 h-5 object-contain" />
          <span>GESTURE STUDIO</span>
        </div>
        <span>•</span>
        <Link to="/about" className="hover:text-black hover:underline">
          ABOUT US
        </Link>
        <span>•</span>
        <Link to="/contact" className="text-black font-black hover:underline">
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
