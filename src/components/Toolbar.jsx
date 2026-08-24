/**
 * Toolbar
 * Color picker, stroke width, clear/save actions in Neo-Brutalism design.
 */

const PRESET_COLORS = [
  { label: 'Violet',  hex: '#A855F7' },
  { label: 'Sky',     hex: '#00F0FF' },
  { label: 'Emerald', hex: '#4ADE80' },
  { label: 'Rose',    hex: '#FF66C4' },
  { label: 'Yellow',  hex: '#FFE600' },
  { label: 'Orange',  hex: '#FF8A00' },
  { label: 'White',   hex: '#FFFFFF' },
  { label: 'Black',   hex: '#000000' },
];

const STROKE_SIZES = [3, 6, 10, 16, 24];

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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#FFFDF5] border-3 border-black shadow-neo-lg max-w-5xl mx-auto">
      
      {/* Left: Color swatches & custom color */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] font-black uppercase text-black hidden sm:inline-block">
          COLOR:
        </span>
        <div className="flex items-center gap-1.5 p-1 bg-white border-2 border-black shadow-neo-sm">
          {PRESET_COLORS.map((c) => {
            const isSelected = strokeColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                title={c.label}
                onClick={() => setStrokeColor(c.hex)}
                className={`
                  w-6 h-6 sm:w-7 sm:h-7 border-2 border-black transition-all cursor-pointer
                  hover:scale-110 active:scale-95
                  ${isSelected ? 'ring-2 ring-offset-1 ring-black scale-110' : 'opacity-90 hover:opacity-100'}
                `}
                style={{
                  backgroundColor: c.hex,
                }}
              />
            );
          })}

          {/* Custom color input */}
          <label
            title="Custom color picker"
            className="
              w-6 h-6 sm:w-7 sm:h-7 border-2 border-black cursor-pointer
              flex items-center justify-center overflow-hidden hover:scale-110 transition-transform
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
          </label>
        </div>
      </div>

      {/* Center: Stroke size selector */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-black uppercase text-black hidden md:inline-block">
          SIZE:
        </span>
        <div className="flex items-center gap-1.5 p-1 bg-white border-2 border-black shadow-neo-sm">
          {STROKE_SIZES.map((size) => {
            const isSelected = strokeWidth === size;
            return (
              <button
                key={size}
                title={`${size}px`}
                onClick={() => setStrokeWidth(size)}
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 border-2 flex items-center justify-center transition-all cursor-pointer
                  ${isSelected 
                    ? 'border-black bg-neo-yellow shadow-neo-sm font-black' 
                    : 'border-transparent hover:border-black/30 hover:bg-zinc-100'}
                `}
              >
                <span
                  className="rounded-full border border-black/40"
                  style={{
                    width: Math.min(size + 2, 20),
                    height: Math.min(size + 2, 20),
                    backgroundColor: strokeColor === '#FFFFFF' ? '#000000' : strokeColor,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Mode toggles & Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Drawing toggle */}
        <button
          onClick={onToggleDrawing}
          className={`
            px-3 py-1.5 text-xs font-mono font-black uppercase border-2 border-black transition-all cursor-pointer
            ${drawingEnabled
              ? 'bg-neo-lime text-black shadow-neo-sm hover:bg-neo-limeLight'
              : 'bg-zinc-200 text-zinc-600 shadow-none'}
            active:translate-x-0.5 active:translate-y-0.5
          `}
        >
          {drawingEnabled ? '🖊️ DRAW ON' : '✖ DRAW OFF'}
        </button>

        {/* Glow toggle */}
        <button
          onClick={() => setGlowEnabled(!glowEnabled)}
          className={`
            px-3 py-1.5 text-xs font-mono font-black uppercase border-2 border-black transition-all cursor-pointer
            ${glowEnabled
              ? 'bg-neo-yellow text-black shadow-neo-sm hover:bg-neo-yellowLight'
              : 'bg-zinc-200 text-zinc-600 shadow-none'}
            active:translate-x-0.5 active:translate-y-0.5
          `}
        >
          {glowEnabled ? '✨ GLOW ON' : '✨ GLOW OFF'}
        </button>

        {/* Clear Action */}
        <button
          onClick={onClear}
          className="neo-btn-danger px-3 py-1.5 text-xs"
          title="Clear Canvas"
        >
          🗑️ CLEAR
        </button>

        {/* Save PNG Action */}
        <button
          onClick={onSave}
          className="neo-btn-cyan px-3 py-1.5 text-xs"
          title="Save as PNG"
        >
          💾 SAVE PNG
        </button>
      </div>

    </div>
  );
}
