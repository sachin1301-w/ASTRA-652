import { ExternalLink, Info } from 'lucide-react'
import { useState } from 'react'

const EXPERIENCE_ID = import.meta.env.VITE_CONVAI_EXPERIENCE_ID

/**
 * Attempts to show Convai's official financial advisor via its public Share Link
 * (https://x.convai.com/experience/{id}), without the paid Pixel Streaming
 * Embed product this account's free plan doesn't support.
 *
 * Verified technical facts behind this component (not assumptions):
 * - The Share Link page sends `Content-Security-Policy: frame-ancestors *`
 *   and `X-Frame-Options: ALLOWALL` - framing it from any origin, including
 *   localhost, is NOT blocked by browser security. No CORS/CSP workaround
 *   needed or attempted here.
 * - BUT the page's own content requires the *viewer* to be logged into a
 *   Convai account - confirmed with curl (zero cookies, zero referrer):
 *   it renders "Experience Not Found" regardless of origin. This is a
 *   content-level auth gate on Convai's side, not a framing restriction,
 *   and it cannot be detected from our JS: the iframe is cross-origin, so
 *   `iframe.contentDocument` is blocked by the browser and we can't read
 *   what it actually rendered.
 *
 * Practical effect: if you personally are signed into Convai in the same
 * browser you're viewing this site with, the embed below may show the real
 * avatar (your session cookie carries over). Anyone else - including real
 * end users - will see Convai's own "Experience Not Found" screen instead.
 * That's why the "Open FinLens Advisor" button (guaranteed to work, since
 * it's a plain top-level navigation) is always shown alongside it, not
 * hidden behind a success/failure check we can't actually perform.
 *
 * To upgrade later: once domain whitelisting is available (paid plan),
 * replace the iframe with `@convai/experience-embed`'s `PixelStreamComponent`.
 */
export default function ConvaiAvatarEmbed({ experienceId: propId }) {
  const [iframeFailed, setIframeFailed] = useState(false)
  const activeId = propId || import.meta.env.VITE_CONVAI_EXPERIENCE_ID

  if (!activeId) return null

  const shareUrl = `https://x.convai.com/experience/${activeId}`

  return (
    <section className="rounded-2xl border-2 border-brand-blue-light bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-ink">Official Convai Financial Advisor</h2>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Open FinLens Advisor
        </a>
      </div>

      <div className="mb-2 flex items-start gap-2 rounded-lg bg-brand-blue-light p-2.5 text-brand-ink/80">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <p className="text-xs">
          Convai Avatar Preview is available in a separate window on the current plan. The embedded
          preview below only shows the real avatar if you're signed into Convai in this browser -
          otherwise it will show Convai's own "not found" screen. Use the button above for a
          guaranteed working view.
        </p>
      </div>

      {!iframeFailed && (
        <iframe
          src={shareUrl}
          title="Convai FinLens advisor preview"
          className="h-56 w-full rounded-lg border border-brand-blue-light"
          allow="camera; microphone; autoplay"
          onError={() => setIframeFailed(true)}
        />
      )}
    </section>
  )
}
