import React, { useState, useEffect } from 'react';
import { useGestureAcademy } from '../hooks/useGestureAcademy';

const GAME_GESTURE_INFO = {
  'fruit-ninja': {
    title: 'Fruit Ninja Controls',
    tips: [
      { emoji: '☝️', label: 'Index', desc: 'Slice airborne fruit' },
      { emoji: '✌️', label: 'Peace', desc: 'Dual blade slice' },
      { emoji: '🤟', label: 'Rock', desc: 'Pause game' },
    ],
  },
  'flappy-bird': {
    title: 'Flappy Bird Controls',
    tips: [
      { emoji: '🤏', label: 'Pinch', desc: 'Flap wings & jump' },
      { emoji: '🤟', label: 'Rock', desc: 'Pause game' },
    ],
  },
  'archery': {
    title: 'Archery Controls',
    tips: [
      { emoji: '🤏', label: 'Pinch', desc: 'Draw bowstring & aim' },
      { emoji: '✋', label: 'Release', desc: 'Release pinch to shoot' },
      { emoji: '🤟', label: 'Rock', desc: 'Pause game' },
    ],
  },
  'bird-hunter': {
    title: 'Bird Hunter Controls',
    tips: [
      { emoji: '🤏', label: 'Pinch', desc: 'Grab ball & pull slingshot' },
      { emoji: '✋', label: 'Release', desc: 'Release pinch to fire' },
      { emoji: '✊', label: 'Fist', desc: 'Cancel aim' },
      { emoji: '🤟', label: 'Rock', desc: 'Pause game' },
    ],
  },
  'hill-climb': {
    title: 'Crazy Road Controls',
    tips: [
      { emoji: '☝️', label: 'Index', desc: 'Left Lane (1)' },
      { emoji: '✌️', label: 'Peace', desc: 'Center Lane (2)' },
      { emoji: '🤟', label: 'Rock', desc: 'Right Lane (3)' },
      { emoji: '✊', label: 'Fist', desc: 'Nitro Boost' },
    ],
  },
  'air-draw': {
    title: 'Air Draw Controls',
    tips: [
      { emoji: '☝️', label: 'Index', desc: 'Draw in mid-air' },
      { emoji: '✌️', label: 'Peace', desc: 'Eraser mode' },
      { emoji: '✊', label: 'Fist', desc: 'Pan canvas' },
      { emoji: '✋', label: 'Palm', desc: 'Stop / Hover' },
    ],
  },
};

export default function InGameGestureGuide({ gameName }) {
  const { settings } = useGestureAcademy(gameName);
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(false);

  const info = GAME_GESTURE_INFO[gameName];

  // Auto fade out after 6 seconds if not minimized
  useEffect(() => {
    if (!settings.showGuide) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 6500);

    return () => clearTimeout(timer);
  }, [settings.showGuide]);

  if (!settings.showGuide || !info) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 transition-all duration-300 select-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-20 hover:opacity-100 translate-y-0'
      }`}
    >
      {minimized ? (
        <button
          onClick={() => {
            setMinimized(false);
            setVisible(true);
          }}
          className="bg-neo-yellow border-2 border-black shadow-neo-sm px-3 py-1.5 font-mono text-xs font-black flex items-center gap-1.5 hover:bg-yellow-300 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          title="Show Gesture Guide"
        >
          <span>✋</span>
          <span>GUIDE</span>
        </button>
      ) : (
        <div className="bg-white/95 backdrop-blur-sm border-3 border-black shadow-neo-md p-3 rounded-none max-w-xs animate-in fade-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🎮</span>
              <span className="font-display font-black text-xs uppercase tracking-tight text-black">
                {info.title}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized(true)}
                className="w-5 h-5 flex items-center justify-center font-mono font-bold text-xs bg-zinc-100 hover:bg-zinc-200 border border-black"
                title="Minimize guide"
              >
                _
              </button>
              <button
                onClick={() => setVisible(false)}
                className="w-5 h-5 flex items-center justify-center font-mono font-bold text-xs bg-red-100 hover:bg-red-200 border border-black text-red-600"
                title="Hide guide"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Tips List */}
          <div className="space-y-1.5">
            {info.tips.map((tip, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-neo-cream/80 border border-black/80 px-2 py-1"
              >
                <span className="text-lg leading-none">{tip.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-black text-[11px] uppercase mr-1.5 text-black">
                    {tip.label}:
                  </span>
                  <span className="text-[11px] font-medium text-zinc-700">
                    {tip.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-2 text-[10px] font-mono text-zinc-500 flex justify-between items-center">
            <span>Fades automatically</span>
            <span className="font-bold text-black">🤟 = Pause</span>
          </div>
        </div>
      )}
    </div>
  );
}

