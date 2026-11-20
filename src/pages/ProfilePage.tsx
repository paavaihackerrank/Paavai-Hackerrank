import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { ACADEMIC_YEARS, DEPARTMENTS, ROLE_META } from '../config/rbacAndData';
import { isValidOptionalImageUrl, useApp } from '../context/AppContext';
import { NotificationBanner } from '../components/NotificationBanner';
import { ProfileBadges } from '../components/ProfileBadges';
import { SocialConnections } from '../components/SocialConnections';
import { CodingActivityHeatmap } from '../components/CodingActivityHeatmap';
import { CommunityEngagementWidget } from '../components/CommunityEngagementWidget';
import { MemberAvatar } from '../components/MemberAvatar';
import { PageSeo } from '../components/PageSeo';

export const ProfilePage: React.FC = () => {
  const {
    firebaseUser,
    currentUser,
    needsEmailVerification,
    unverifiedEmail,
    events,
    resources,
    completedResourceIds,
    codingActivities,
    eventCheckIns,
    leaderboard,
    registrations,
    updateOwnProfile,
    cancelRegistration,
    logCodingActivity,
    deleteCodingActivity,
  } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState(currentUser?.name ?? '');
  const [department, setDepartment] = useState(currentUser?.department ?? DEPARTMENTS[0]);
  const [year, setYear] = useState(currentUser?.year ?? ACADEMIC_YEARS[0]);
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl ?? '');
  const [photoError, setPhotoError] = useState('');
  const [handle, setHandle] = useState(currentUser?.hackerRankHandle ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [skillsText, setSkillsText] = useState(currentUser?.skills.join(', ') ?? '');

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name);
    setDepartment(currentUser.department);
    setYear(currentUser.year);
    setPhone(currentUser.phone);
    setPhotoUrl(currentUser.photoUrl ?? '');
    setPhotoError('');
    setHandle(currentUser.hackerRankHandle);
    setBio(currentUser.bio);
    setSkillsText(currentUser.skills.join(', '));
  }, [currentUser]);

  if (needsEmailVerification && unverifiedEmail) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 space-y-6">
        <PageSeo
          title="Verify Member Profile"
          description="Verify your email address to activate your HackerRank Campus Crew member profile."
          noIndex
        />
        <NotificationBanner
          user={firebaseUser}
          onVerified={(path) => navigate(path, { replace: true })}
        />

        <header className="space-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-5">
          <p className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
            Account Activation Pending · Verification Required
          </p>
          <h1 className="font-mono text-3xl font-bold text-slate-900 dark:text-white">
            Member Profile
          </h1>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {unverifiedEmail} · Verify your email link to unlock profile editing and event registration
          </p>
        </header>
      </div>
    );
  }

  if (!currentUser) return null;

  const myRegistrations = registrations.filter((r) => r.userId === currentUser.id);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedPhoto = photoUrl.trim();
    if (!isValidOptionalImageUrl(trimmedPhoto)) {
      setPhotoError('Enter a valid image URL starting with https:// or http:// (max 500 characters).');
      return;
    }
    setPhotoError('');
    updateOwnProfile({
      name: name.trim(),
      department,
      year,
      phone: phone.trim(),
      photoUrl: trimmedPhoto,
      hackerRankHandle: handle.trim(),
      bio: bio.trim(),
      skills: skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <PageSeo
        title={`${currentUser.name} – Member Profile`}
        description={
          currentUser.bio ||
          `${currentUser.name} (${currentUser.department}, ${currentUser.year}) · ${ROLE_META[currentUser.role].label} at Paavai Engineering College.`
        }
        type="profile"
        image={photoUrl || currentUser.photoUrl}
        imageAlt={`${currentUser.name} profile photo`}
        profile={{ username: currentUser.hackerRankHandle || currentUser.id }}
        noIndex
      />
      <NotificationBanner
        user={currentUser}
        onVerified={(path) => navigate(path, { replace: true })}
        compact
      />

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 min-w-0">
          <MemberAvatar
            name={currentUser.name}
            photoUrl={photoUrl || currentUser.photoUrl}
            variant={currentUser.role}
            sizeClass="w-16 h-16 sm:w-20 sm:h-20"
            textClass="text-xl"
          />
          <div className="space-y-2 min-w-0">
            <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
              {ROLE_META[currentUser.role].label} · Verified Member
            </p>
            <h1 className="font-mono text-3xl font-bold text-slate-900 dark:text-white truncate">
              {currentUser.name}
            </h1>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {currentUser.email}
              {currentUser.collegeEmail &&
              currentUser.collegeEmail.toLowerCase() !== currentUser.email.toLowerCase()
                ? ` · College ID: ${currentUser.collegeEmail}`
                : ''}{' '}
              · Reg No. {currentUser.regNo} · Joined {currentUser.joinedAt}
            </p>
          </div>
        </div>

        <Link
          to={`/members/${encodeURIComponent(currentUser.id)}`}
          className="px-3.5 py-2 rounded-lg text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
        >
          View Public Profile →
        </Link>
      </header>

      <CommunityEngagementWidget
        user={currentUser}
        resources={resources}
        completedResourceIds={completedResourceIds}
        leaderboard={leaderboard}
        eventCheckIns={eventCheckIns}
        registrations={registrations}
        codingActivities={codingActivities}
      />

      <ProfileBadges
        user={currentUser}
        resources={resources}
        completedResourceIds={completedResourceIds}
        leaderboard={leaderboard}
      />

      <CodingActivityHeatmap
        user={currentUser}
        codingActivities={codingActivities}
        eventCheckIns={eventCheckIns}
        onLogActivity={logCodingActivity}
        onDeleteActivity={deleteCodingActivity}
      />

      <SocialConnections
        user={currentUser}
        onSave={async (socialUpdates) => {
          await updateOwnProfile(socialUpdates);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Edit Profile Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5"
        >
          <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
            Edit Member Profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                HackerRank Handle
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
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
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              >
                {ACADEMIC_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="profile-photo-url"
              className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Profile Image URL (displayed on Profile &amp; Team Page)
            </label>
            <div className="flex items-center gap-3">
              <MemberAvatar
                name={name || currentUser.name}
                photoUrl={photoUrl}
                variant={currentUser.role}
                sizeClass="w-11 h-11"
                roundedClass="rounded-lg"
                textClass="text-xs"
              />
              <div className="relative flex-1">
                <ImageIcon
                  className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="profile-photo-url"
                  type="url"
                  value={photoUrl}
                  onChange={(e) => {
                    setPhotoUrl(e.target.value);
                    if (photoError) setPhotoError('');
                  }}
                  placeholder="https://example.com/your-photo.jpg"
                  className="w-full h-10 pl-9 pr-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
            </div>
            {photoError ? (
              <p role="alert" className="text-[11px] font-mono text-red-500 mt-1">
                {photoError}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Paste a direct <span className="font-mono">https://</span> image URL. Leave blank to
                display your initials monogram.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
              Skills (comma-separated)
            </label>
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
              Short Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
          >
            Save Profile Changes
          </button>
        </form>

        {/* Registered Events History */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              My Registered Events ({myRegistrations.length})
            </h2>
            <Link
              to="/events"
              className="text-xs font-mono text-[#009942] dark:text-[#00EA64] hover:underline"
            >
              Browse events →
            </Link>
          </div>

          {myRegistrations.length === 0 ? (
            <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] text-sm text-slate-500 space-y-3">
              <p>You have not registered for any upcoming contests or workshops yet.</p>
              <Link
                to="/events"
                className="inline-block px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14]"
              >
                Explore Campus Events
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myRegistrations.map((reg) => {
                const ev = events.find((e) => e.id === reg.eventId);
                return (
                  <div
                    key={reg.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confirmed
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {reg.registeredAt}
                      </span>
                    </div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {ev?.title ?? reg.eventId}
                    </h3>
                    {ev && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(ev.dateISO).toLocaleDateString('en-IN')} · {ev.venue}
                      </p>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => cancelRegistration(reg.eventId)}
                        className="text-xs font-mono text-slate-500 hover:text-red-500 transition-colors"
                      >
                        Cancel registration
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
