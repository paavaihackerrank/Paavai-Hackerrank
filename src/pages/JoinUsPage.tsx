import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { ACADEMIC_YEARS, CHAPTER_IMAGES, DEPARTMENTS } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { PageSeo } from '../components/PageSeo';

export const JoinUsPage: React.FC = () => {
  const { submitJoinRequest, siteSettings, currentUser } = useApp();

  const [form, setForm] = useState({
    name: '',
    registerNumber: '',
    department: DEPARTMENTS[0],
    year: ACADEMIC_YEARS[0],
    email: '',
    phone: '',
    skills: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedSignupUrl, setSubmittedSignupUrl] = useState('/signup');
  const [submittedIsPaavaiEmail, setSubmittedIsPaavaiEmail] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3) next.name = 'Enter your full name (at least 3 characters).';
    if (!/^[A-Za-z0-9]{8,16}$/.test(form.registerNumber.trim())) {
      next.registerNumber = 'Enter a valid Paavai Register Number (8–16 alphanumeric characters, e.g. 622125104088).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid college or personal email address.';
    }
    if (!/^[+\d\s-]{10,15}$/.test(form.phone.trim())) {
      next.phone = 'Enter a valid 10-digit phone number.';
    }
    if (form.skills.trim().length < 3) {
      next.skills = 'List at least one language or technical interest (e.g., Python, DSA, SQL).';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanReg = form.registerNumber.trim().toUpperCase();
    const res = await submitJoinRequest({
      name: form.name.trim(),
      registerNumber: cleanReg,
      department: form.department,
      year: form.year,
      email: cleanEmail,
      phone: form.phone.trim(),
      skills: form.skills.trim(),
    });
    setSubmitting(false);

    const isPaavai = cleanEmail.endsWith('@paavai.edu.in');
    const params = new URLSearchParams();
    if (res.id) params.set('joinReqId', res.id);
    params.set('name', form.name.trim());
    params.set('regNo', cleanReg);
    params.set('dept', form.department);
    params.set('year', form.year);
    params.set('phone', form.phone.trim());
    if (isPaavai) {
      params.set('collegeEmail', cleanEmail);
    } else {
      params.set('email', cleanEmail);
    }
    setSubmittedIsPaavaiEmail(isPaavai);
    setSubmittedSignupUrl(`/signup?${params.toString()}`);
    setSubmitted(true);
  };

  if (!siteSettings.applicationsOpen) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
        <PageSeo
          title="Page Currently Unavailable"
          description={`Explore upcoming coding events and learning tracks at ${siteSettings.collegeName}.`}
          noIndex
        />
        <h1 className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          This Page Is Currently Unavailable
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Explore upcoming coding contests, technical workshops, and learning roadmaps on the portal.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors"
          >
            Back to Home
          </Link>
          <Link
            to="/events"
            className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors"
          >
            Explore Events
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
      <PageSeo
        title="Join HackerRank Campus Crew"
        description={`Apply to join the HackerRank Campus Crew at ${siteSettings.collegeName}. Practice DSA, participate in coding sprints, and grow with peers.`}
        canonicalPath="/join"
        image={CHAPTER_IMAGES.hero}
        keywords={['Join Coding Club', 'Paavai Student Membership', 'HackerRank Campus Crew']}
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Context Column */}
        <div className="lg:col-span-5 space-y-5">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Membership Intake · {siteSettings.collegeName}
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Request to Join the Crew
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            Ready to join? Sign up directly with your personal email, unique{' '}
            <strong>@paavai.edu.in</strong> college email ID, and phone number to get immediate
            Student Community Member access once verified. Or submit your interest here to connect
            with the HackerRank Campus Crew team.
          </p>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
              How onboarding works
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <li>Students register with a personal email, unique @paavai.edu.in ID, and unique phone number.</li>
              <li>Prospective contributors can share their skills via this intake form.</li>
              <li>Campus Lead reviews Crew interest applications in the Lead Dashboard.</li>
            </ol>
          </div>

          {currentUser && (
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-xs text-slate-600 dark:text-slate-300">
              You are already signed in as <strong>{currentUser.name}</strong>. Submissions appear
              live in the Lead Dashboard under Join Inquiries.
            </div>
          )}
        </div>

        {/* Right Form Card */}
        <div className="lg:col-span-7">
          {submitted ? (
            <div className="p-8 rounded-xl border border-[#00EA64]/40 bg-white dark:bg-[#121821] space-y-4">
              <CheckCircle2 className="w-10 h-10 text-[#009942] dark:text-[#00EA64]" />
              <h2 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                Inquiry Received
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Thank you, <strong>{form.name}</strong> ({form.registerNumber}). Your Crew inquiry
                has been recorded in the Lead Dashboard.
                {submittedIsPaavaiEmail
                  ? ' Because you applied with your @paavai.edu.in college email, continue directly to pre-filled student signup — once you verify your personal email, your Join Request will automatically approve and close!'
                  : ' Continue to pre-filled student signup with your personal email and @paavai.edu.in college ID to activate instant Student Community Member access.'}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {!currentUser && (
                  <Link
                    to={submittedSignupUrl}
                    className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>Continue to Pre-Filled Signup</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setForm({
                      name: '',
                      registerNumber: '',
                      department: DEPARTMENTS[0],
                      year: ACADEMIC_YEARS[0],
                      email: '',
                      phone: '',
                      skills: '',
                    });
                  }}
                  className="px-4 py-2.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64]"
                >
                  Submit Another Request
                </button>
                <Link
                  to="/events"
                  className="px-4 py-2.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64]"
                >
                  Browse Public Events
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="join-name" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    id="join-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Priya Dharshini S"
                    className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="join-reg" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    Register Number *
                  </label>
                  <input
                    id="join-reg"
                    type="text"
                    value={form.registerNumber}
                    onChange={(e) => setForm({ ...form, registerNumber: e.target.value })}
                    placeholder="e.g., 622125104042"
                    className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  />
                  {errors.registerNumber && (
                    <p className="text-xs text-red-500 mt-1">{errors.registerNumber}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="join-dept" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    Department *
                  </label>
                  <select
                    id="join-dept"
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="join-year" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    Academic Year *
                  </label>
                  <select
                    id="join-year"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  >
                    {ACADEMIC_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="join-email" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    College Email *
                  </label>
                  <input
                    id="join-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@paavai.edu.in"
                    className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="join-phone" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                    Phone Number *
                  </label>
                  <input
                    id="join-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                  />
                  {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="join-skills" className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1.5">
                  Technical Skills & Programming Languages *
                </label>
                <textarea
                  id="join-skills"
                  rows={3}
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="e.g., Python, C++, Java, SQL, Basic DSA, Web Development"
                  className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                {errors.skills && <p className="text-xs text-red-500 mt-1">{errors.skills}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg text-sm font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 transition-colors"
              >
                {submitting ? 'Submitting Request...' : 'Submit Membership Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
