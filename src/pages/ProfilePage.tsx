import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import {
  ACADEMIC_YEARS,
  DEPARTMENTS,
  EventCertificate,
  EventRegistration,
  ROLE_META,
  buildAttendeeTicketCode,
  isOnlineAttendanceEnabled,
  isOnlineEvent,
} from '../config/rbacAndData';
import { isValidOptionalImageUrl, useApp } from '../context/AppContext';
import { DRIVE_SHARING_HINT, validateDriveOrHttpsUrl } from '../lib/driveUtils';
import { downloadCertificatePng } from '../lib/certificateCanvas';
import { NotificationBanner } from '../components/NotificationBanner';
import { ProfileBadges } from '../components/ProfileBadges';
import { SocialConnections } from '../components/SocialConnections';
import { CodingActivityHeatmap } from '../components/CodingActivityHeatmap';
import { CommunityEngagementWidget } from '../components/CommunityEngagementWidget';
import { MemberAvatar } from '../components/MemberAvatar';
import { DriveDocumentViewer } from '../components/DriveDocumentViewer';
import { StudentEventTicketModal } from '../components/StudentEventTicketModal';
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
    certificates,
    siteSettings,
    leaderboard,
    registrations,
    updateOwnProfile,
    cancelRegistration,
    resendEventTicketEmail,
    claimParticipationCertificate,
    logCodingActivity,
    syncHackerRankPractice,
    deleteCodingActivity,
  } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState(currentUser?.name ?? '');
  const [department, setDepartment] = useState(currentUser?.department ?? DEPARTMENTS[0]);
  const [year, setYear] = useState(currentUser?.year ?? ACADEMIC_YEARS[0]);
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoUrl ?? '');
  const [photoError, setPhotoError] = useState('');
  const [documentUrl, setDocumentUrl] = useState(currentUser?.documentUrl ?? '');
  const [docError, setDocError] = useState('');
  const [previewDocOpen, setPreviewDocOpen] = useState(false);
  const [syncingHr, setSyncingHr] = useState(false);
  const [claimingEventId, setClaimingEventId] = useState<string | null>(null);
  const [activeTicketReg, setActiveTicketReg] = useState<EventRegistration | null>(null);
  const [resendingRegId, setResendingRegId] = useState<string | null>(null);
  const [handle, setHandle] = useState(currentUser?.hackerRankHandle ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [skillsText, setSkillsText] = useState(currentUser?.skills.join(', ') ?? '');

  const photoValidation = useMemo(
    () => validateDriveOrHttpsUrl(photoUrl, { allowEmpty: true, allowRelative: true }),
    [photoUrl]
  );
  const docValidation = useMemo(
    () => validateDriveOrHttpsUrl(documentUrl, { allowEmpty: true }),
    [documentUrl]
  );

  useEffect(() => {
    if (!currentUser) return;
    setName(currentUser.name);
    setDepartment(currentUser.department);
    setYear(currentUser.year);
    setPhone(currentUser.phone);
    setPhotoUrl(currentUser.photoUrl ?? '');
    setPhotoError('');
    setDocumentUrl(currentUser.documentUrl ?? '');
    setDocError('');
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

  const isCrewOrLead = currentUser.role === 'crew' || currentUser.role === 'lead';
  const myRegistrations = registrations.filter((r) => r.userId === currentUser.id);
  const myCheckIns = eventCheckIns.filter((c) => c.userId === currentUser.id);
  const myCertificates = certificates.filter((c) => c.recipientUid === currentUser.id);

  const downloadCert = (cert: EventCertificate) => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://paavai-hackerrank.web.app';
    downloadCertificatePng({
      certificate: cert,
      verificationUrl: `${origin}/certificates/${encodeURIComponent(cert.certId)}`,
      leadName: siteSettings.leadName || 'Campus Lead',
    });
  };

  const handleClaimCert = async (eventId: string) => {
    setClaimingEventId(eventId);
    const res = await claimParticipationCertificate(eventId);
    setClaimingEventId(null);
    if (res.ok && res.certificate) {
      downloadCert(res.certificate);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const trimmedPhoto = photoUrl.trim();
    if (!isValidOptionalImageUrl(trimmedPhoto) || !photoValidation.valid) {
      setPhotoError(
        photoValidation.error ||
          'Enter a valid Google Drive share link or https:// image URL (max 500 characters).'
      );
      return;
    }
    const trimmedDoc = documentUrl.trim();
    if (trimmedDoc && !docValidation.valid) {
      setDocError(
        docValidation.error || 'Enter a valid Google Drive link or https:// URL for your document.'
      );
      return;
    }
    setPhotoError('');
    setDocError('');
    updateOwnProfile({
      name: name.trim(),
      department,
      year,
      phone: phone.trim(),
      photoUrl: trimmedPhoto,
      documentUrl: trimmedDoc,
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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {!isCrewOrLead && (
            <button
              type="button"
              disabled={syncingHr}
              onClick={async () => {
                setSyncingHr(true);
                await syncHackerRankPractice();
                setSyncingHr(false);
              }}
              className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold border border-[#00EA64]/50 bg-[#00EA64]/10 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/20 disabled:opacity-60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingHr ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{syncingHr ? 'Syncing…' : 'Sync HackerRank Practice'}</span>
            </button>
          )}
          <Link
            to={`/members/${encodeURIComponent(currentUser.id)}`}
            className="px-3.5 py-2 rounded-lg text-xs font-mono font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] transition-colors whitespace-nowrap shrink-0"
          >
            View Public Profile →
          </Link>
        </div>
      </header>

      {/* 1. Edit Member Profile */}
      <form
        onSubmit={handleSave}
        className="p-6 sm:p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-5"
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="profile-photo-url"
              className="block text-xs font-mono text-slate-500 dark:text-slate-400"
            >
              Profile Image Link — Google Drive or Direct URL
            </label>
            {photoUrl.trim() && photoValidation.valid && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                <span>{photoValidation.isDrive ? 'Drive Image Resolved' : 'Image URL Verified'}</span>
              </span>
            )}
          </div>
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
                placeholder="https://drive.google.com/file/d/.../view"
                className="w-full h-10 pl-9 pr-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>
          {photoError || (!photoValidation.valid && photoUrl.trim()) ? (
            <p role="alert" className="text-[11px] font-mono text-red-500 mt-1">
              {photoError || photoValidation.error}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {photoUrl.trim()
                ? photoValidation.hint
                : `Paste a Google Drive share link or https:// URL. ${DRIVE_SHARING_HINT}.`}
            </p>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="profile-doc-url"
              className="block text-xs font-mono text-slate-500 dark:text-slate-400"
            >
              Portfolio / Resume / Project Document (Google Drive PDF, Docs, or Slides)
            </label>
            {documentUrl.trim() && docValidation.valid && (
              <button
                type="button"
                onClick={() => setPreviewDocOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/25 transition-colors"
              >
                <FileText className="w-3 h-3" aria-hidden="true" />
                <span>Preview Document</span>
              </button>
            )}
          </div>
          <div className="relative">
            <FileText
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="profile-doc-url"
              type="url"
              value={documentUrl}
              onChange={(e) => {
                setDocumentUrl(e.target.value);
                if (docError) setDocError('');
              }}
              placeholder="https://drive.google.com/file/d/.../view or https://docs.google.com/..."
              className="w-full h-10 pl-9 pr-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
            />
          </div>
          {docError || (!docValidation.valid && documentUrl.trim()) ? (
            <p role="alert" className="text-[11px] font-mono text-red-500 mt-1">
              {docError || docValidation.error}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {documentUrl.trim()
                ? docValidation.hint
                : `Displayed on your public member profile. ${DRIVE_SHARING_HINT}.`}
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

      {/* 2. Technical Portfolio · Public Showcase / Social Connections */}
      <SocialConnections
        user={currentUser}
        onSave={async (socialUpdates) => {
          await updateOwnProfile(socialUpdates);
        }}
      />

      {/* 3. My Registered Events */}
      <section className="space-y-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myRegistrations.map((reg) => {
              const ev = events.find((e) => e.id === reg.eventId);
              const onlineEv = isOnlineEvent(ev);
              const onlineAttOpen = isOnlineAttendanceEnabled(ev);
              const isCheckedIn = myCheckIns.some((c) => c.eventId === reg.eventId);
              const issuedCert = myCertificates.find((c) => c.eventId === reg.eventId);
              return (
                <div
                  key={reg.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-mono text-[#009942] dark:text-[#00EA64]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isCheckedIn
                        ? onlineEv
                          ? 'Attendance Recorded'
                          : 'QR Checked In'
                        : 'Confirmed'}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {reg.registeredAt}
                    </span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    <Link
                      to={`/events/${encodeURIComponent(reg.eventId)}`}
                      className="hover:text-[#009942] dark:hover:text-[#00EA64] transition-colors"
                    >
                      {ev?.title ?? reg.eventId}
                    </Link>
                  </h3>
                  {ev && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(ev.dateISO).toLocaleDateString('en-IN')} · {ev.venue}
                    </p>
                  )}
                  {onlineEv ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        Online Event · No QR check-in required
                      </span>
                      {onlineAttOpen && !isCheckedIn && (
                        <span className="font-mono text-[10px] font-semibold text-[#009942] dark:text-[#00EA64]">
                          Attendance Open
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        Pass:{' '}
                        <strong className="text-slate-900 dark:text-white">
                          {reg.ticketCode || buildAttendeeTicketCode(reg.eventId, reg.userId)}
                        </strong>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {reg.ticketEmailStatus === 'sent' ? 'QR Emailed' : 'QR Ready'}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      {onlineEv ? (
                        <Link
                          to={`/events/${encodeURIComponent(reg.eventId)}`}
                          className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>
                            {onlineAttOpen && !isCheckedIn
                              ? 'Mark Attendance'
                              : 'Open Event Page'}
                          </span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveTicketReg(reg)}
                            className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1"
                          >
                            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Entry QR Pass</span>
                          </button>
                          <button
                            type="button"
                            disabled={resendingRegId === reg.id}
                            onClick={async () => {
                              setResendingRegId(reg.id);
                              await resendEventTicketEmail(reg.id);
                              setResendingRegId(null);
                            }}
                            className="px-2 py-1.5 rounded-md text-[11px] font-mono border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-[#00EA64] disabled:opacity-50 inline-flex items-center gap-1"
                            title="Email this unique Entry Pass QR to your inbox"
                          >
                            <Mail className="w-3 h-3" aria-hidden="true" />
                            <span>{resendingRegId === reg.id ? 'Sending…' : 'Email QR'}</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {issuedCert ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => downloadCert(issuedCert)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64] hover:bg-[#00EA64]/25 inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>E-Certificate</span>
                          </button>
                          <Link
                            to={`/certificates/${encodeURIComponent(issuedCert.certId)}`}
                            className="p-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-[#00EA64]"
                            title="Verify E-Certificate"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ) : isCheckedIn ? (
                        <button
                          type="button"
                          disabled={claimingEventId === reg.eventId}
                          onClick={() => handleClaimCert(reg.eventId)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 inline-flex items-center gap-1"
                        >
                          <Award className="w-3 h-3" />
                          <span>
                            {claimingEventId === reg.eventId
                              ? 'Claiming...'
                              : 'Claim E-Certificate'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cancelRegistration(reg.eventId)}
                          className="text-xs font-mono text-slate-500 hover:text-red-500 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTicketReg && (
          <StudentEventTicketModal
            registration={activeTicketReg}
            event={events.find((e) => e.id === activeTicketReg.eventId)}
            isCheckedIn={myCheckIns.some((c) => c.eventId === activeTicketReg.eventId)}
            onClose={() => setActiveTicketReg(null)}
            onResendEmail={async (regId) => {
              await resendEventTicketEmail(regId);
            }}
          />
        )}
      </section>

      {/* 4. My Verifiable E-Certificates */}
      {(myCertificates.length > 0 ||
        myCheckIns.some((c) => !myCertificates.some((cert) => cert.eventId === c.eventId))) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-[#009942] dark:text-[#00EA64]" aria-hidden="true" />
                <span>My Verified E-Certificates ({myCertificates.length})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download high-resolution PNG credentials or share your public HRCC Paavai
                verification link on LinkedIn and resumes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myCertificates.map((cert) => (
              <div
                key={cert.id}
                className="p-5 rounded-xl border border-[#00EA64]/35 bg-white dark:bg-[#121821] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#00EA64]/15 text-[#009942] dark:text-[#00EA64]">
                    {cert.awardType}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 truncate max-w-[180px]">
                    {cert.certId}
                  </span>
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {cert.eventTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Issued {new Date(cert.issuedAt).toLocaleDateString('en-IN')} · By{' '}
                    {cert.issuedByName}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => downloadCert(cert)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Download PNG</span>
                  </button>
                  <Link
                    to={`/certificates/${encodeURIComponent(cert.certId)}`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#00EA64] inline-flex items-center gap-1.5"
                  >
                    <span>Verify / Share</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ))}

            {/* Unclaimed QR Check-Ins ready to claim */}
            {myCheckIns
              .filter((c) => !myCertificates.some((cert) => cert.eventId === c.eventId))
              .map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="p-5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-[#0E141C] space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Ready to Claim · Verified Attendance
                    </span>
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {checkIn.eventTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {checkIn.checkInCode === 'ONLINE-ATTENDANCE'
                        ? 'Online attendance confirmed on '
                        : 'QR check-in confirmed on '}
                      {new Date(checkIn.checkedInAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={claimingEventId === checkIn.eventId}
                    onClick={() => handleClaimCert(checkIn.eventId)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {claimingEventId === checkIn.eventId
                        ? 'Generating E-Certificate...'
                        : 'Claim & Download E-Certificate'}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Student Member Activity & Achievements (Hidden on Campus Crew & Campus Lead Profiles) */}
      {!isCrewOrLead && (
        <>
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
            onSyncHackerRank={syncHackerRankPractice}
          />
        </>
      )}

      <DriveDocumentViewer
        url={previewDocOpen ? documentUrl.trim() : null}
        title={`${name || currentUser.name} — Portfolio / Project Document`}
        subtitle="Live Profile Preview"
        onClose={() => setPreviewDocOpen(false)}
      />
    </div>
  );
};
