import React, { useState } from 'react';
import { ChevronDown, Mail, MapPin } from 'lucide-react';
import { FAQ_ITEMS } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { EmailDeliveryFaq } from '../components/EmailDeliveryFaq';
import { PageSeo } from '../components/PageSeo';

export const ContactFaqPage: React.FC = () => {
  const { siteSettings, addToast } = useApp();
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0].id);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please include a message of at least 10 characters.');
      return;
    }
    setError('');
    addToast(
      'Message sent to Campus Crew',
      `We will reply to ${email.trim()} shortly.`,
      'success'
    );
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-16">
      <PageSeo
        title="FAQ & Contact"
        description={`Answers about joining HackerRank Campus Crew, email verification whitelisting, contests, and contacting chapter coordinators at ${siteSettings.collegeName}.`}
        canonicalPath="/contact"
        keywords={['Campus Crew FAQ', 'Email Verification Help', 'Contact Paavai Coding Club']}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ_ITEMS.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }}
      />
      <header className="max-w-2xl space-y-3">
        <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
          Help Center & Chapter Desk
        </p>
        <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          FAQ & Contact
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
          Common questions about membership, roles, contests, and reaching the HackerRank Campus
          Crew at {siteSettings.collegeName}.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* FAQ Accordion */}
        <section aria-labelledby="faq-heading" className="lg:col-span-7 space-y-4">
          <h2 id="faq-heading" className="font-mono text-lg font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div key={item.id} className="p-5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#00EA64]' : ''
                      }`}
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
        </section>

        {/* Contact Form & Chapter Details */}
        <section aria-labelledby="contact-heading" className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5">
            <h2
              id="contact-heading"
              className="font-mono text-lg font-bold text-slate-900 dark:text-white"
            >
              Contact the Crew
            </h2>
            <form onSubmit={handleContact} noValidate className="space-y-4">
              {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
              <div>
                <label htmlFor="contact-name" className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Your Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Email Address
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label htmlFor="contact-msg" className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1">
                  Message
                </label>
                <textarea
                  id="contact-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Questions about upcoming contests, sponsorships, or mentorship..."
                  className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
              >
                Send Message
              </button>
            </form>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0 mt-1" />
              <span>
                {siteSettings.collegeName}, {siteSettings.campusLocation}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#009942] dark:text-[#00EA64] shrink-0" />
              <span className="font-mono text-xs">{siteSettings.contactEmail}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Email Delivery & Provider Whitelisting FAQ */}
      <EmailDeliveryFaq />
    </div>
  );
};
