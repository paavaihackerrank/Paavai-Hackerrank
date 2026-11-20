import React, { useState } from 'react';
import { Check, ChevronDown, Copy, MailCheck, ShieldCheck } from 'lucide-react';
import firebaseAppletConfig from '../../firebase-applet-config.json';

type EmailProviderKey = 'gmail' | 'outlook' | 'yahoo';

interface DeliveryFaqItem {
  id: string;
  question: string;
  answer: string;
}

const DELIVERY_FAQ_ITEMS: DeliveryFaqItem[] = [
  {
    id: 'deliv_01',
    question: 'Why did my verification or password reset email go to Spam or Promotions?',
    answer:
      'Verification and password reset emails are sent automatically by Firebase Auth from firebaseapp.com. Mailbox providers frequently filter automated transactional messages into Spam, Junk, or Gmail Promotions/Updates tabs until you mark the sender as safe.',
  },
  {
    id: 'deliv_02',
    question: 'Why do we sign up with a personal email instead of @paavai.edu.in?',
    answer:
      'Institutional gateways often quarantine or silently drop external authentication links before they reach your inbox. Using your personal Gmail, Outlook, or Yahoo address guarantees reliable delivery while keeping your unique @paavai.edu.in ID linked on your profile.',
  },
  {
    id: 'deliv_03',
    question: 'How long should I wait before clicking "Resend Verification Email"?',
    answer:
      'Most verification messages arrive within 30 to 120 seconds. Clicking resend repeatedly within 60 seconds triggers Firebase rate protection (auth/too-many-requests) and temporarily pauses delivery. Wait for the cooldown timer, check Spam, and whitelist the sender domain below.',
  },
  {
    id: 'deliv_04',
    question: 'I clicked the verification link on my phone—why is my browser still asking to verify?',
    answer:
      'Your desktop browser caches your previous unverified token until refreshed. Return to the verification banner and click "Check Status" (or sign out and sign back in) to sync your verified status immediately.',
  },
];

const PROVIDER_GUIDES: Record<
  EmailProviderKey,
  {
    label: string;
    inboxName: string;
    steps: string[];
    tip: string;
  }
> = {
  gmail: {
    label: 'Gmail',
    inboxName: 'Gmail (Web & Mobile)',
    steps: [
      'Open Gmail and check Spam and Promotions/Updates tabs, or paste the search filter above into the search bar.',
      'If found in Spam, open the message and click "Report not spam". If in Promotions, drag it to your Primary tab and confirm future messages go to Primary.',
      'Click the Settings gear → "See all settings" → "Filters and Blocked Addresses" → "Create a new filter".',
      'In the "From" field, enter firebaseapp.com (or the noreply sender address above), click "Create filter", check "Never send it to Spam" and "Always mark it as important", then save.',
    ],
    tip: 'Adding the sender address to Google Contacts also prevents future verification links from entering Spam.',
  },
  outlook: {
    label: 'Outlook',
    inboxName: 'Outlook / Hotmail / Live',
    steps: [
      'Open Outlook.com and check both your "Junk Email" folder and the "Other" tab if Focused Inbox is enabled.',
      'If the message is in Junk Email, right-click it and select "Security options" → "Mark as not junk".',
      'Click the Settings gear (top-right) → "Mail" → "Junk email" → "Safe senders and domains".',
      'Click "+ Add safe sender", enter firebaseapp.com and the noreply sender address above, press Enter, and click "Save".',
    ],
    tip: 'Check "Blocked senders and domains" on the same settings screen to confirm firebaseapp.com was not accidentally blocked.',
  },
  yahoo: {
    label: 'Yahoo',
    inboxName: 'Yahoo Mail',
    steps: [
      'Open Yahoo Mail and check your "Spam" folder; if found, open the email and click "Not Spam".',
      'Click "Settings" (gear icon) → "More Settings" → "Filters" → "Add new filters".',
      'Name the filter "HackerRank Campus Crew", set the rule "From" → "contains" → firebaseapp.com.',
      'Under "Choose a folder to move to", select "Inbox", click "Save", and add the sender address to your Yahoo Contacts.',
    ],
    tip: 'Avoid clicking multiple resends rapidly in Yahoo Mail, as Yahoo temporarily defers bursts of automated links.',
  },
};

export const EmailDeliveryFaq: React.FC = () => {
  const [openDeliveryId, setOpenDeliveryId] = useState<string | null>(DELIVERY_FAQ_ITEMS[0].id);
  const [activeProvider, setActiveProvider] = useState<EmailProviderKey>('gmail');
  const [copiedKey, setCopiedKey] = useState<'sender' | 'query' | null>(null);

  const authDomain = firebaseAppletConfig.authDomain || 'firebaseapp.com';
  const senderAddress = `noreply@${authDomain}`;
  const searchQuery = `from:firebaseapp.com OR from:${authDomain} OR "Verify your email"`;
  const currentGuide = PROVIDER_GUIDES[activeProvider];

  const handleCopy = async (key: 'sender' | 'query', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <section
      aria-labelledby="email-delivery-faq-heading"
      className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-8"
    >
      <div className="max-w-3xl space-y-2">
        <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64] flex items-center gap-1.5">
          <MailCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Verification &amp; Reset Email Delivery</span>
        </p>
        <h2
          id="email-delivery-faq-heading"
          className="font-mono text-2xl font-bold text-slate-900 dark:text-white"
        >
          Email Delivery &amp; Whitelisting FAQ
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Troubleshooting steps and inbox whitelisting instructions for Gmail, Outlook, and Yahoo
          so account verification and password reset emails always arrive in your Primary inbox.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Delivery Troubleshooting Accordion */}
        <div className="lg:col-span-6 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          {DELIVERY_FAQ_ITEMS.map((item) => {
            const isOpen = openDeliveryId === item.id;
            return (
              <div key={item.id} className="p-5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenDeliveryId(isOpen ? null : item.id)}
                  className="w-full flex items-center justify-between gap-4 text-left"
                >
                  <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#00EA64]' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Provider Whitelisting Instructions (Gmail / Outlook / Yahoo) */}
        <div className="lg:col-span-6 p-6 sm:p-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="font-mono text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck
                  className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0"
                  aria-hidden="true"
                />
                <span>Provider Whitelisting Guide</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select your email provider to add our verification sender to your Safe Senders list.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Select email provider whitelisting guide"
              className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-slate-800 self-start sm:self-auto"
            >
              {(['gmail', 'outlook', 'yahoo'] as const).map((key) => {
                const active = activeProvider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveProvider(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white dark:bg-[#121821] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {PROVIDER_GUIDES[key].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copyable Sender & Search Filter Box */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F14] space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 block">
                  Sender Address to Whitelist
                </span>
                <code className="font-mono text-slate-900 dark:text-white break-all">
                  {senderAddress}
                </code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('sender', senderAddress)}
                className="px-2.5 py-1.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {copiedKey === 'sender' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Sender</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 block">
                  Quick Mailbox Search Query
                </span>
                <code className="font-mono text-slate-700 dark:text-slate-300 break-all">
                  {searchQuery}
                </code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy('query', searchQuery)}
                className="px-2.5 py-1.5 rounded-md text-xs font-mono border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {copiedKey === 'query' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00EA64]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Copy Query</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Provider Step-by-Step Instructions */}
          <div className="space-y-3">
            <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
              Steps for {currentGuide.inboxName}
            </p>
            <ol className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {currentGuide.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="font-mono text-xs font-bold tabular-nums text-[#009942] dark:text-[#00EA64] pt-0.5 shrink-0">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
              Tip: {currentGuide.tip}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
