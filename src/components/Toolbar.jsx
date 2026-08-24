/**
 * Toolbar
 * Responsive Neo-Brutalist studio palette:
 * - Vertical right-hand sidebar on desktop (md+)
 * - Compact bottom toolbar on mobile (<md)
 */

const PRESET_COLORS = [
  { label: 'Purple',  hex: '#A855F7' },
  { label: 'Cyan',    hex: '#00F0FF' },
  { label: 'Lime',    hex: '#4ADE80' },
  { label: 'Pink',    hex: '#FF66C4' },
  { label: 'Yellow',  hex: '#FFE600' },
  { label: 'Orange',  hex: '#FF8A00' },
  { label: 'White',   hex: '#FFFFFF' },
  { label: 'Black',   hex: '#000000' },
];

const STROKE_SIZES = [
  { size: 3, label: 'S' },
  { size: 6, label: 'M' },
  { size: 10, label: 'L' },
  { size: 16, label: 'XL' },
  { size: 24, label: '2X' },
];

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
    <div className="w-full flex flex-col gap-3.5 sm:gap-4 font-sans">
      
      {/* ── Section: Color Palette ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-black uppercase tracking-wider text-black flex items-center gap-1">
            <span>🎨</span> COLOR
          </span>
          <div
            className="w-4 h-4 border-2 border-black shadow-[1px_1px_0px_#000]"
            style={{ backgroundColor: strokeColor }}
            title={strokeColor}
          />
        </div>

        {/* Color Swatches Grid */}
        <div className="p-2 bg-white border-2 md:border-3 border-black shadow-neo-sm">
          <div className="grid grid-cols-5 md:grid-cols-4 gap-1.5 sm:gap-2">
            {PRESET_COLORS.map((c) => {
              const isSelected = strokeColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  title={c.label}
                  onClick={() => setStrokeColor(c.hex)}
                  className={`
                    w-full aspect-square border-2 border-black transition-all cursor-pointer flex items-center justify-center
                    hover:scale-105 active:scale-95
                    ${isSelected ? 'ring-2 ring-offset-1 ring-black shadow-[2px_2px_0px_#000] scale-105' : 'opacity-90 hover:opacity-100'}
                  `}
                  style={{ backgroundColor: c.hex }}
                >
                  {isSelected && (
                    <span className="text-[10px] leading-none" style={{ color: c.hex === '#FFFFFF' || c.hex === '#FFE600' || c.hex === '#00F0FF' || c.hex === '#4ADE80' ? '#000' : '#FFF' }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom color picker */}
            <label
              title="Custom Color Picker"
              className="
                w-full aspect-square border-2 border-black cursor-pointer
                flex items-center justify-center overflow-hidden hover:scale-105 transition-transform
                shadow-[1px_1px_0px_#000]
              "
              style={{
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
              }}
            >
              <input
                type="color"
                className="opacity-0 w-0 h-0 absolute cursor-pointer"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
              <span className="text-[9px] font-black bg-white/90 px-0.5 border border-black leading-none">
                +
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Section: Brush Size ── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-black uppercase tracking-wider text-black flex items-center gap-1">
            <span>✏️</span> BRUSH SIZE
          </span>
          <span className="font-mono text-[11px] font-bold text-zinc-600">
            {strokeWidth}px
          </span>
        </div>

        <div className="p-1.5 bg-white border-2 md:border-3 border-black shadow-neo-sm grid grid-cols-5 gap-1.5">
          {STROKE_SIZES.map(({ size, label }) => {
            const isSelected = strokeWidth === size;
            return (
              <button
                key={size}
                title={`${size}px`}
                onClick={() => setStrokeWidth(size)}
                className={`
                  py-1.5 border-2 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer
                  ${isSelected 
                    ? 'border-black bg-neo-yellow shadow-[2px_2px_0px_#000] font-black' 
                    : 'border-transparent hover:border-black/30 hover:bg-zinc-100'}
                `}
              >
                <span
                  className="rounded-full border border-black/40"
                  style={{
                    width: Math.min(size + 2, 18),
                    height: Math.min(size + 2, 18),
                    backgroundColor: strokeColor === '#FFFFFF' ? '#000000' : strokeColor,
                  }}
                />
                <span className="font-mono text-[9px] font-bold leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section: Mode Toggles ── */}
      <div className="flex flex-col gap-2 pt-1 border-t-2 border-black/15">
        <span className="font-mono text-xs font-black uppercase tracking-wider text-black">
          MODES & FX
        </span>

        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
          {/* Drawing toggle */}
          <button
            onClick={onToggleDrawing}
            className={`
              w-full py-2 px-3 text-xs font-mono font-black uppercase border-2 md:border-3 border-black transition-all cursor-pointer
              flex items-center justify-between
              ${drawingEnabled
                ? 'bg-neo-lime text-black shadow-neo-sm hover:bg-neo-limeLight'
                : 'bg-zinc-200 text-zinc-600 shadow-none'}
              active:translate-x-0.5 active:translate-y-0.5
            `}
          >
            <span>🖊️ DRAWING</span>
            <span>{drawingEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Glow toggle */}
          <button
            onClick={() => setGlowEnabled(!glowEnabled)}
            className={`
              w-full py-2 px-3 text-xs font-mono font-black uppercase border-2 md:border-3 border-black transition-all cursor-pointer
              flex items-center justify-between
              ${glowEnabled
                ? 'bg-neo-yellow text-black shadow-neo-sm hover:bg-neo-yellowLight'
                : 'bg-zinc-200 text-zinc-600 shadow-none'}
              active:translate-x-0.5 active:translate-y-0.5
            `}
          >
            <span>✨ GLOW EFFECT</span>
            <span>{glowEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── Section: Actions ── */}
      <div className="flex flex-col gap-2 pt-1 border-t-2 border-black/15">
        <span className="font-mono text-xs font-black uppercase tracking-wider text-black">
          CANVAS ACTIONS
        </span>

        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
          {/* Clear Action */}
          <button
            onClick={onClear}
            className="neo-btn-danger w-full py-2.5 px-3 text-xs uppercase flex items-center justify-center gap-1.5"
            title="Clear all strokes from canvas"
          >
            <span>🗑️</span>
            <span>CLEAR CANVAS</span>
          </button>

          {/* Save PNG Action */}
          <button
            onClick={onSave}
            className="neo-btn-cyan w-full py-2.5 px-3 text-xs uppercase flex items-center justify-center gap-1.5"
            title="Export drawing as PNG image"
          >
            <span>💾</span>
            <span>EXPORT PNG</span>
          </button>
        </div>
      </div>

    </div>
  );
}
