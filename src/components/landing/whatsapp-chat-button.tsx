'use client';

import Link from 'next/link';

const WHATSAPP_PHONE = '919573299175'; // +91 9573299175 — Nikhil
const PREFILL_MESSAGE = encodeURIComponent(
  "Hi! I'm interested in learning more about GrainFlow. Can you help me get started?"
);

/**
 * Floating WhatsApp chat button. Opens a WhatsApp chat with GrainFlow sales
 * (Nikhil) when tapped. Visible only on pages that explicitly include this
 * component — currently the public landing page.
 */
export function WhatsAppChatButton() {
  const href = `https://wa.me/${WHATSAPP_PHONE}?text=${PREFILL_MESSAGE}`;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg transition-transform hover:scale-105 hover:bg-[#20BA5A] active:scale-95 md:px-5 md:py-3"
    >
      {/* WhatsApp icon */}
      <svg
        viewBox="0 0 32 32"
        width="28"
        height="28"
        fill="currentColor"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="M16 .396C7.164.396 0 7.56 0 16.396c0 2.885.756 5.589 2.08 7.929L.033 32l7.878-2.067a15.94 15.94 0 0 0 8.089 2.166h.004c8.836 0 16-7.164 16-16s-7.168-16-16.004-16zm0 29.333c-2.528 0-4.99-.68-7.146-1.967l-.511-.304-5.203 1.365 1.389-5.069-.334-.521A13.238 13.238 0 0 1 2.667 16.4C2.667 9.036 8.636 3.067 16 3.067S29.333 9.036 29.333 16.4c0 7.365-5.969 13.329-13.333 13.329zm7.318-9.888c-.4-.2-2.368-1.167-2.735-1.302-.367-.133-.633-.2-.9.2-.267.4-1.033 1.302-1.267 1.569-.233.267-.467.3-.867.1-.4-.2-1.69-.623-3.22-1.987-1.19-1.062-1.993-2.373-2.227-2.773-.233-.4-.025-.617.175-.816.181-.18.4-.467.6-.7.2-.233.267-.4.4-.667.133-.267.067-.5-.033-.7-.1-.2-.9-2.167-1.233-2.967-.325-.779-.655-.673-.9-.686-.233-.013-.5-.016-.767-.016-.267 0-.7.1-1.067.5-.367.4-1.4 1.367-1.4 3.333 0 1.967 1.433 3.867 1.633 4.133.2.267 2.818 4.305 6.827 6.04.953.412 1.697.658 2.278.843.957.305 1.83.262 2.519.159.769-.115 2.368-.967 2.702-1.902.334-.935.334-1.738.233-1.902-.1-.167-.367-.267-.767-.467z" />
      </svg>
      <span className="hidden text-sm font-semibold md:inline">Chat on WhatsApp</span>
    </Link>
  );
}
