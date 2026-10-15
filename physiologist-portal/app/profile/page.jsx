'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '../../components/Nav';
import { api, getToken, clearToken, setUserName } from '../../lib/api';
import { SkProfileHero, SkSection } from '../../components/Skeleton';

const SPECIALIZATIONS = [
  'Sports Physiotherapy', 'Musculoskeletal', 'Neurological', 'Orthopedic',
  'Pediatric', 'Geriatric', 'Cardiopulmonary', "Women's Health",
  'Post-Surgical Rehab', 'Pain Management',
];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  // Fields
  const [name,              setName]              = useState('');
  const [email,             setEmail]             = useState('');
  const [specialization,    setSpecialization]    = useState('');
  const [yearsExp,          setYearsExp]          = useState('');
  const [bio,               setBio]               = useState('');
  const [education,         setEducation]         = useState([]);
  const [googleConnected,   setGoogleConnected]   = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get('/api/physiologist/profile')
      .then(d => {
        const u = d.user;
        setName(u.name || '');
        setEmail(u.email || '');
        setSpecialization(u.specialization || '');
        setYearsExp(u.yearsExperience != null ? String(u.yearsExperience) : '');
        setBio(u.bio || '');
        setEducation(u.education || []);
        setGoogleConnected(!!(u.googleTokens && u.googleTokens.refreshToken));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const addEdu = () => setEducation(prev => [...prev, { degree: '', institution: '', year: '' }]);
  const removeEdu = (i) => setEducation(prev => prev.filter((_, idx) => idx !== i));
  const patchEdu = (i, k, v) =>
    setEducation(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const cleanedEdu = education.filter(e => e.degree || e.institution);
      const data = await api.patch('/api/physiologist/profile', {
        name,
        specialization,
        yearsExperience: yearsExp ? Number(yearsExp) : null,
        bio,
        education: cleanedEdu,
      });
      setUserName(data.user.name);
      setSuccess('Profile saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#111113]">
        <Nav />
        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <SkProfileHero />
          <div className="space-y-6">
            <SkSection lines={3} />
            <SkSection lines={2} />
            <SkSection lines={4} />
            <SkSection lines={3} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#111113]">
      <Nav />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">

        {/* Profile hero */}
        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-full bg-[#DA7235]/20 border-2 border-[#DA7235]/40 flex items-center justify-center text-2xl font-bold text-[#DA7235] flex-shrink-0">
            {initials(name)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{name || '—'}</h1>
            <p className="text-white/40 text-sm mt-0.5">{email}</p>
            {specialization && (
              <span className="mt-1.5 inline-block px-2.5 py-0.5 rounded-full text-xs bg-[#DA7235]/15 text-[#DA7235] border border-[#DA7235]/25">
                {specialization}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">

          {/* Basic info */}
          <Section title="Basic information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" value={name} onChange={setName} placeholder="Dr. Jane Smith" />
              <Field label="Email" value={email} disabled placeholder="" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Years of experience</label>
                <input
                  type="number" min="0" max="60"
                  value={yearsExp}
                  onChange={e => setYearsExp(e.target.value)}
                  placeholder="e.g. 8"
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#DA7235]"
                />
              </div>
            </div>
          </Section>

          {/* Specialization */}
          <Section title="Specialization">
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map(s => (
                <button key={s} type="button"
                  onClick={() => setSpecialization(prev => prev === s ? '' : s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    specialization === s
                      ? 'bg-[#DA7235] border-[#DA7235] text-white'
                      : 'border-white/10 text-white/50 hover:border-[#DA7235]/50 hover:text-white/70'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </Section>

          {/* Google Calendar integration */}
          <Section title="Google Calendar">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">
                  {googleConnected ? 'Google Calendar connected' : 'Connect your Google Calendar'}
                </p>
                <p className="text-xs text-white/30 mt-0.5">
                  {googleConnected
                    ? 'New appointments will automatically create Google Meet links and appear in your calendar.'
                    : 'Let Active Mentor create Google Meet links and calendar events when patients book appointments.'}
                </p>
              </div>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/google?token=${getToken()}`}
                className={`flex-shrink-0 ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  googleConnected
                    ? 'border border-[#22c55e]/30 text-[#22c55e] hover:border-[#22c55e]/60'
                    : 'bg-[#DA7235] text-white hover:bg-[#c5622a]'
                }`}>
                {googleConnected ? 'Reconnect' : 'Connect'}
              </a>
            </div>
          </Section>

          {/* Bio */}
          <Section title="About you">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={5}
              placeholder="Describe your clinical approach, areas of focus, or what patients can expect working with you…"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#DA7235] resize-none"
            />
          </Section>

          {/* Education */}
          <Section title="Education & credentials">
            <div className="space-y-3">
              {education.map((entry, i) => (
                <div key={i} className="rounded-lg border border-white/8 p-4 relative">
                  <button type="button" onClick={() => removeEdu(i)}
                    className="absolute top-3 right-3 text-white/20 hover:text-red-400 transition-colors text-lg leading-none">
                    ×
                  </button>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs text-white/40 mb-1">Degree / Certification</label>
                      <input type="text" value={entry.degree}
                        placeholder="e.g. Bachelor of Physiotherapy"
                        onChange={e => patchEdu(i, 'degree', e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#DA7235]" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-white/40 mb-1">Institution</label>
                      <input type="text" value={entry.institution}
                        placeholder="University or college"
                        onChange={e => patchEdu(i, 'institution', e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#DA7235]" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/40 mb-1">Year</label>
                      <input type="number" value={entry.year}
                        placeholder="2018" min="1950" max="2030"
                        onChange={e => patchEdu(i, 'year', e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#DA7235]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addEdu}
              className="mt-3 w-full py-2 rounded-lg border border-dashed border-white/15 text-white/35 hover:border-[#DA7235]/40 hover:text-[#DA7235] text-sm transition-colors">
              + Add degree or certification
            </button>
          </Section>

          {/* Danger zone */}
          <Section title="Account">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Sign out of the portal</p>
                <p className="text-xs text-white/25 mt-0.5">You'll need to log in again to access your dashboard</p>
              </div>
              <button
                onClick={() => { clearToken(); window.location.href = '/login'; }}
                className="px-4 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/30 text-sm transition-colors">
                Log out
              </button>
            </div>
          </Section>

          {/* Save */}
          {error   && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-[#22c55e] text-sm">{success}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <div className="h-12" />
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
      <p className="text-xs text-white/35 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label className="block text-xs text-white/40 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:border-[#DA7235] ${
          disabled
            ? 'bg-white/[0.02] border-white/5 text-white/30 cursor-not-allowed'
            : 'bg-white/5 border-white/10 text-white placeholder:text-white/20'
        }`}
      />
      {disabled && <p className="text-xs text-white/20 mt-1">Email cannot be changed here</p>}
    </div>
  );
}
