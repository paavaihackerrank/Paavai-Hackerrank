import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { CHAPTER_IMAGES, GalleryPhoto } from '../config/rbacAndData';
import { useApp } from '../context/AppContext';
import { SafeImage } from '../components/SafeImage';
import { PageSeo } from '../components/PageSeo';

export const GalleryPage: React.FC = () => {
  const { gallery, can, addGalleryPhoto, deleteGalleryPhoto } = useApp();
  const [category, setCategory] = useState<'All' | GalleryPhoto['category']>('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Upload form state
  const [title, setTitle] = useState('');
  const [photoCat, setPhotoCat] = useState<GalleryPhoto['category']>('Hackathon');
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState(CHAPTER_IMAGES.hackathonArena);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(
    () => gallery.filter((g) => category === 'All' || g.category === category),
    [gallery, category]
  );

  useEffect(() => {
    if (lightboxIdx === null || filtered.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') {
        setLightboxIdx((i) => (i === null ? null : (i + 1) % filtered.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIdx, filtered.length]);

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !caption.trim() || !imageUrl.trim()) {
      setFormError('Please fill in photo title, caption, and image URL.');
      return;
    }
    addGalleryPhoto({
      title: title.trim(),
      category: photoCat,
      caption: caption.trim(),
      imageUrl: imageUrl.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setTitle('');
    setCaption('');
    setFormError('');
    setUploadOpen(false);
  };

  const activePhoto = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-10">
      <PageSeo
        title="Event Gallery"
        description={`Browse ${gallery.length} campus highlights from HackerRank Campus Crew hackathons, DSA workshops, and award ceremonies at Paavai Engineering College.`}
        canonicalPath="/gallery"
        image={gallery[0]?.imageUrl || CHAPTER_IMAGES.hackathonArena}
        keywords={['Hackathon Photos', 'Paavai Gallery', 'Coding Workshops']}
      />
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <p className="font-mono text-xs font-semibold text-[#009942] dark:text-[#00EA64]">
            Campus Moments · Workshops & Contests
          </p>
          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Event Gallery
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Snapshots from Paavai Engineering College coding sprints, algorithm clinics, and award
            ceremonies. Click any photo to open the full lightbox.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#121821] border border-slate-200 dark:border-slate-800">
            {(['All', 'Hackathon', 'Workshop', 'Awards', 'Community'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategory(cat);
                  setLightboxIdx(null);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  category === cat
                    ? 'bg-white dark:bg-[#1B2432] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Upload Button — Strictly visible ONLY to Campus Lead & Campus Crew */}
          {can('canUploadGallery') && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="h-9 px-4 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Upload Photo</span>
            </button>
          )}
        </div>
      </header>

      {/* Gallery Grid */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821]">
          <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {gallery.length === 0
              ? 'No event photos have been uploaded yet.'
              : 'No event photos match this category yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((photo, idx) => (
            <article
              key={photo.id}
              className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] flex flex-col"
            >
              <button
                type="button"
                onClick={() => setLightboxIdx(idx)}
                className="aspect-[4/3] w-full overflow-hidden bg-slate-900 text-left relative focus-visible:outline-none"
              >
                <SafeImage
                  src={photo.imageUrl}
                  alt={photo.title}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  fallbackTitle={photo.title}
                />
              </button>
              <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {photo.category} · {photo.date}
                  </p>
                  <h2 className="font-mono text-base font-bold text-slate-900 dark:text-white mt-1">
                    {photo.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {photo.caption}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Uploaded by {photo.uploadedBy}</span>
                  {can('canDeleteGallery') && (
                    <button
                      type="button"
                      onClick={() => deleteGalleryPhoto(photo.id)}
                      aria-label={`Delete ${photo.title}`}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Accessible Lightbox Modal */}
      {activePhoto && lightboxIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="max-w-4xl w-full bg-[#0F151D] border border-slate-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 text-slate-200">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold truncate">{activePhoto.title}</p>
                <p className="text-xs text-slate-400">
                  {activePhoto.category} · {activePhoto.date} · {lightboxIdx + 1} / {filtered.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIdx(null)}
                aria-label="Close lightbox"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-[16/10] bg-black flex items-center justify-center">
              <SafeImage
                src={activePhoto.imageUrl}
                alt={activePhoto.title}
                className="w-full h-full object-contain"
              />
              {filtered.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      setLightboxIdx((lightboxIdx - 1 + filtered.length) % filtered.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => setLightboxIdx((lightboxIdx + 1) % filtered.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="px-5 py-4 text-sm text-slate-300">{activePhoto.caption}</div>
          </div>
        </div>
      )}

      {/* Upload Photo Modal (Lead & Crew Only) */}
      {uploadOpen && can('canUploadGallery') && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload Gallery Photo"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setUploadOpen(false)}
        >
          <div
            className="max-w-lg w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121821] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                Upload Gallery Photo
              </h2>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {formError && (
                <p className="text-xs text-red-500 font-medium">{formError}</p>
              )}
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                  Photo Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Winter CodeSprint Finals"
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={photoCat}
                  onChange={(e) => setPhotoCat(e.target.value as GalleryPhoto['category'])}
                  className="w-full h-10 px-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                >
                  <option value="Hackathon">Hackathon</option>
                  <option value="Workshop">Workshop</option>
                  <option value="Awards">Awards</option>
                  <option value="Community">Community</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                  Image URL or Preset Campus Photo
                </label>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg text-sm font-mono bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    ['Hackathon', CHAPTER_IMAGES.hackathonArena],
                    ['Workshop', CHAPTER_IMAGES.dsaWorkshop],
                    ['Awards', CHAPTER_IMAGES.awardCeremony],
                    ['Lab Session', CHAPTER_IMAGES.hero],
                  ].map(([lbl, url]) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setImageUrl(url)}
                      className="px-2 py-1 text-[11px] font-mono rounded border border-slate-300 dark:border-slate-700 hover:border-[#00EA64]"
                    >
                      Use {lbl} preset
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                  Caption
                </label>
                <textarea
                  rows={3}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe the session or contest highlight..."
                  className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-[#0B0F14] border border-slate-300 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
                >
                  Publish Photo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
