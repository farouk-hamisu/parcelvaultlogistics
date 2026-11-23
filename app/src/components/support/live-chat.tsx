import { useEffect } from 'react'
import { MessageCircle, Headphones } from 'lucide-react'
import { cn } from '../../lib/utils'

const BREVO_CONVERSATIONS_ID = '6b03f11ca7cabc123e01cbf2'
const BREVO_SCRIPT_SRC = 'https://conversations-widget.brevo.com/brevo-conversations.js'

type BrevoFn = ((...args: any[]) => void) & { q?: any[] }

declare global {
  interface Window {
    BrevoConversationsID?: string
    BrevoConversations?: BrevoFn
    BrevoConversationsSetup?: Record<string, unknown>
  }
}

let loadingPromise: Promise<void> | null = null

/**
 * Initialise Brevo Conversations exactly the way the provider documents it:
 * a queuing stub is installed immediately, then the official script loads
 * asynchronously. Calling the stub before the script arrives is safe.
 */
export function ensureLiveChat(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (loadingPromise) return loadingPromise

  loadingPromise = new Promise<void>((resolve) => {
    window.BrevoConversationsID = BREVO_CONVERSATIONS_ID

    if (typeof window.BrevoConversations !== 'function') {
      const queued: BrevoFn = function (...args: any[]) {
        ;(queued.q = queued.q || []).push(args)
      }
      window.BrevoConversations = queued
    }

    if (document.querySelector(`script[src="${BREVO_SCRIPT_SRC}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = BREVO_SCRIPT_SRC
    script.onload = () => resolve()
    script.onerror = () => {
      // Allow a later click to retry loading the widget.
      loadingPromise = null
      resolve()
    }
    document.head.appendChild(script)
  })

  return loadingPromise
}

/** Open the Brevo chat window from anywhere in the app. */
export function openLiveChat() {
  if (typeof window === 'undefined') return
  void ensureLiveChat()

  if (typeof window.BrevoConversations === 'function') {
    window.BrevoConversations('openChat', true)
    return
  }

  // Last-resort fallback: Brevo also supports a hash that expands the widget.
  window.location.hash = '#brevoConversationsExpanded'
}

/** Mounted once in the customer-facing layout so the widget is always ready. */
export function LiveChat() {
  useEffect(() => {
    void ensureLiveChat()
  }, [])
  return null
}

type SupportButtonProps = {
  label?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'onDark' | 'link'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  icon?: 'chat' | 'headset'
  fullWidth?: boolean
}

const VARIANTS: Record<string, string> = {
  primary: 'bg-primary text-navy hover:bg-[#0898A0] shadow-[0_8px_24px_-8px_rgba(5,163,170,0.5)]',
  secondary: 'bg-navy text-white hover:bg-ocean-blue shadow-[0_8px_24px_-8px_rgba(5,45,75,0.45)]',
  outline: 'bg-white text-navy ring-1 ring-border hover:bg-background',
  ghost: 'text-navy hover:bg-background',
  onDark: 'bg-primary text-navy hover:bg-primary-light',
  link: 'text-primary-dark hover:text-primary underline-offset-4 hover:underline px-0 py-0',
}

const SIZES: Record<string, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-5 py-3 text-sm',
  lg: 'px-7 py-4 text-base',
}

/**
 * The single public call-to-action for support. Every public phone number and
 * email address has been replaced with this button, which opens live chat.
 */
export function ContactSupportButton({
  label = 'Contact Customer Support',
  variant = 'primary',
  size = 'md',
  className,
  icon = 'chat',
  fullWidth,
}: SupportButtonProps) {
  const Icon = icon === 'headset' ? Headphones : MessageCircle
  return (
    <button
      type="button"
      onClick={openLiveChat}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[14px] font-semibold transition-all duration-300 active:scale-[0.98]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
        VARIANTS[variant],
        variant === 'link' ? '' : SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      <Icon className={cn(variant === 'link' ? 'size-4' : 'size-4 shrink-0')} />
      {label}
    </button>
  )
}
