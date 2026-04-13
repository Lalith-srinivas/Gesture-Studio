/**
 * Toolbar
 * Color picker, stroke width, clear/save actions.
 */

const PRESET_COLORS = [
  { label: 'Violet',  hex: '#a78bfa' },
  { label: 'Sky',     hex: '#38bdf8' },
  { label: 'Emerald', hex: '#34d399' },
  { label: 'Rose',    hex: '#fb7185' },
  { label: 'Amber',   hex: '#fbbf24' },
  { label: 'White',   hex: '#f4f4f5' },
];

const STROKE_SIZES = [2, 4, 8, 14, 22];

export default function Toolbar({
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  onClear,
  onSave,
  drawingEnabled,
  onToggleDrawing,
  glowEnabled,
  setGlowEnabled,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 glass-panel">
      {/* Color swatches */}
      <div className="flex items-center gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.hex}
            title={c.label}
            onClick={() => setStrokeColor(c.hex)}
            className="
              w-7 h-7 rounded-full border-2 transition-all duration-150
              hover:scale-110 active:scale-95 focus:outline-none
            "
            style={{
              backgroundColor: c.hex,
              borderColor: strokeColor === c.hex ? '#ffffff' : 'transparent',
              boxShadow: strokeColor === c.hex
                ? `0 0 0 2px ${c.hex}55, 0 0 12px ${c.hex}66`
                : 'none',
            }}
          />
        ))}

        {/* Custom color input */}
        <label
          title="Custom color"
          className="
            w-7 h-7 rounded-full border-2 border-white/20 cursor-pointer
            flex items-center justify-center overflow-hidden
            hover:scale-110 transition-transform
          "
          style={{
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
          }}
        >
          <input
            type="color"
            className="opacity-0 w-0 h-0 absolute"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
          />
        </label>
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Stroke width */}
      <div className="flex items-center gap-1.5">
        {STROKE_SIZES.map((size) => (
          <button
            key={size}
            title={`${size}px`}
            onClick={() => setStrokeWidth(size)}
            className="
              w-8 h-8 rounded-lg flex items-center justify-center
              transition-all duration-150 hover:bg-white/10 active:scale-95
              border border-transparent
            "
            style={{
              borderColor: strokeWidth === size ? 'rgba(255,255,255,0.3)' : 'transparent',
              background: strokeWidth === size ? 'rgba(255,255,255,0.08)' : '',
            }}
          >
            <span
              className="rounded-full"
              style={{
                width:  Math.min(size + 4, 20),
                height: Math.min(size + 4, 20),
                backgroundColor: strokeColor,
                opacity: 0.85,
              }}
            />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Drawing toggle */}
      <button
        onClick={onToggleDrawing}
        className={`
          px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200
          ${drawingEnabled
            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
            : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'}
        `}
      >
        {drawingEnabled ? '🖊 On' : '✖ Off'}
      </button>

      <div className="w-px h-6 bg-white/10" />

      {/* Glow toggle */}
      <button
        onClick={() => setGlowEnabled(!glowEnabled)}
        className={`
          px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200
          ${glowEnabled
            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'}
        `}
      >
        {glowEnabled ? '✨ Glow On' : '✨ Glow Off'}
      </button>

      <div className="w-px h-6 bg-white/10" />

      {/* Action buttons */}
      <button onClick={onClear} className="btn-danger flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear
      </button>

      <button onClick={onSave} className="btn-success flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Save PNG
      </button>
    </div>
  );
}
