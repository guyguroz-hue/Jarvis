/** Decorative viewport chrome: corner brackets and edge ticks. */
export default function HudFrame() {
  const corner = 'absolute h-6 w-6 border-jarvis-cyan/40'
  return (
    <div className="pointer-events-none absolute inset-0 z-[14]">
      <div className={`${corner} left-3 top-3 border-l-2 border-t-2`} />
      <div className={`${corner} right-3 top-3 border-r-2 border-t-2`} />
      <div className={`${corner} bottom-3 left-3 border-b-2 border-l-2`} />
      <div className={`${corner} bottom-3 right-3 border-b-2 border-r-2`} />

      {/* Edge ticks */}
      <div className="absolute left-3 top-1/2 h-10 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-jarvis-cyan/50 to-transparent" />
      <div className="absolute right-3 top-1/2 h-10 w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-jarvis-cyan/50 to-transparent" />
    </div>
  )
}
