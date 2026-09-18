/**
 * Voice assistant surface: state, live transcript, streamed reply, controls.
 *
 * Status is conveyed with a word as well as a colour — the HUD's status hues
 * are close together under red-green colour blindness.
 */
const STATE = {
  idle: { label: 'Standby', tone: 'text-jarvis-ice/50' },
  thinking: { label: 'Processing', tone: 'text-jarvis-cyan' },
  speaking: { label: 'Speaking', tone: 'text-jarvis-amber' },
  error: { label: 'Fault', tone: 'text-jarvis-alert' },
}

export default function AssistantPanel({ assistant, lang, onToggleLang }) {
  const { status, query, reply, error, armed, listening, interim, supported } = assistant
  const state = STATE[status] ?? STATE.idle

  if (!supported.recognition && !supported.synthesis) {
    return (
      <div className="glass-panel hud-corners p-3 !border-jarvis-alert/40">
        <p className="label !text-jarvis-alert">Voice Unavailable</p>
        <p className="mt-1 text-[10px] leading-relaxed text-jarvis-ice/60">
          This browser has no Web Speech API. Chrome or Edge is required; Firefox
          has no speech recognition.
        </p>
      </div>
    )
  }

  return (
    <div className="glass-panel hud-corners p-3">
      <div className="flex items-center justify-between">
        <p className="label">Neural Link</p>
        <div className="flex items-center gap-2">
          <span className={`font-display text-[10px] uppercase ${state.tone}`}>
            {state.label}
          </span>
          {/* Paired with the word above, never the sole signal */}
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              listening ? 'animate-pulse-glow bg-jarvis-ok' : 'bg-jarvis-ice/25'
            }`}
          />
        </div>
      </div>

      {/* Live microphone text */}
      {armed && (
        <p className="mt-2 min-h-[14px] truncate text-[10px] italic text-jarvis-ice/40">
          {interim || (listening ? 'listening…' : 'restarting…')}
        </p>
      )}

      {query && (
        <p className="mt-2 text-[11px] leading-snug text-white/80">
          <span className="label !text-[9px]">You </span>
          {query}
        </p>
      )}

      {reply && (
        <p className="mt-2 text-[11px] leading-relaxed text-jarvis-ice">
          <span className="label !text-[9px]">Jarvis </span>
          {reply}
          {status === 'thinking' && (
            <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse-glow bg-jarvis-cyan align-middle" />
          )}
        </p>
      )}

      {error && <p className="mt-2 text-[10px] text-jarvis-alert">{error}</p>}

      <div className="mt-3 flex items-center gap-2 border-t border-jarvis-cyan/20 pt-2">
        <button
          onClick={armed ? assistant.disarm : assistant.arm}
          disabled={!supported.recognition}
          className={`flex-1 rounded border py-1.5 font-display text-[9px] uppercase tracking-widest active:bg-jarvis-cyan/20 disabled:opacity-40 ${
            armed
              ? 'border-jarvis-ok/60 text-jarvis-ok'
              : 'border-jarvis-cyan/40 text-jarvis-cyan'
          }`}
        >
          {armed ? 'Listening' : 'Arm Voice'}
        </button>

        <button
          onClick={onToggleLang}
          className="rounded border border-jarvis-cyan/40 px-2 py-1.5 font-display text-[9px] uppercase tracking-widest text-jarvis-cyan active:bg-jarvis-cyan/20"
        >
          {lang.startsWith('he') ? 'HE' : 'EN'}
        </button>

        {(status === 'thinking' || status === 'speaking') && (
          <button
            onClick={assistant.cancel}
            className="rounded border border-jarvis-alert/50 px-2 py-1.5 font-display text-[9px] uppercase tracking-widest text-jarvis-alert active:bg-jarvis-alert/20"
          >
            Stop
          </button>
        )}
      </div>

      {armed && !query && (
        <p className="mt-2 text-center text-[9px] text-jarvis-ice/30">
          Say “Jarvis” followed by your question
        </p>
      )}
    </div>
  )
}
