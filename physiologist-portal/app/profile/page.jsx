'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import ErrorState from '../../components/ui/ErrorState';
import { ProfileSkeleton } from '../../components/ui/Skeletons';
import { api, getToken, clearToken, setUserName } from '../../lib/api';
import ClinicAffiliations from '../../components/ClinicAffiliations';

const SPECIALTIES = [
  'Sports Physiotherapy', 'Musculoskeletal', 'Neurological', 'Orthopedic',
  'Pediatric', 'Geriatric', 'Cardiopulmonary', "Women's Health",
  'Post-Surgical Rehab', 'Pain Management', 'Knee Specialist',
];

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState('');
  const [education, setEducation] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get('/api/physiologist/profile')
      .then(d => {
        const u = d.user;
        setName(u.name || '');
        setEmail(u.email || '');
        setSpecialty(u.specialty || '');
        setYearsExp(u.yearsExperience != null ? String(u.yearsExperience) : '');
        setBio(u.bio || '');
        setPhoto(u.photo || '');
        setEducation(u.education || []);
        setClinics(u.clinics?.length ? u.clinics : []);
        setGoogleConnected(!!(u.googleTokens && u.googleTokens.refreshToken));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const addEdu = () => setEducation(prev => [...prev, { degree: '', institution: '', year: '' }]);
  const removeEdu = (i) => setEducation(prev => prev.filter((_, idx) => idx !== i));
  const patchEdu = (i, k, v) =>
    setEducation(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setSuccess('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const { uploadUrl, fileUrl, contentType } = await api.get(
        `/api/upload/presigned?ext=${encodeURIComponent(ext)}&kind=image`,
      );
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || file.type || 'image/jpeg' },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      setPhoto(fileUrl);
      await api.patch('/api/physiologist/profile', { photo: fileUrl });
      setSuccess('Photo updated.');
    } catch (err) {
      setError(err.message || 'Could not upload photo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const cleanedEdu = education.filter(e => e.degree || e.institution);
      const cleanedClinics = clinics
        .filter(c => c.name || c.branch)
        .map(c => ({
          name: c.name || '',
          branch: c.branch || '',
          address: c.address || c.city || '',
          city: c.city || '',
          placeId: c.placeId || '',
          logoKey: c.logoKey || '',
          photoName: c.photoName || '',
          photoUrl: c.photoUrl || '',
          mapUrl: c.mapUrl || '',
          lat: c.lat ?? null,
          lng: c.lng ?? null,
          source: c.source || (c.logoKey ? 'curated' : c.placeId ? 'places' : 'manual'),
        }));
      const data = await api.patch('/api/physiologist/profile', {
        name,
        specialty,
        yearsExperience: yearsExp ? Number(yearsExp) : null,
        bio,
        education: cleanedEdu,
        clinics: cleanedClinics,
        photo: photo || '',
      });
      setUserName(data.user.name);
      setSuccess('Profile saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const googleHref = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/google?token=${encodeURIComponent(getToken() || '')}&returnTo=${encodeURIComponent('/profile')}`;

  return (
    <AppShell>
      <div className="profile-wrap">
        <PageHeader title="Profile" subtitle="Your clinical profile — shown to patients in the app" />

        {loading ? (
          <GlassCard className="rise">
            <ProfileSkeleton />
          </GlassCard>
        ) : (
          <div className="stack">
            <GlassCard className="rise">
              <div className="profile-id">
                {photo ? (
                  <img src={photo} alt="" className="avatar avatar-lg" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className="avatar avatar-lg" aria-hidden="true">{initials(name)}</span>
                )}
                <div>
                  <h2>{name || '—'}</h2>
                  <p className="page-sub">{email || 'No email on file'}</p>
                  {specialty ? <span className="spec-pill">{specialty}</span> : null}
                  <div style={{ marginTop: 12 }}>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? 'Uploading…' : photo ? 'Change photo' : 'Upload photo'}
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '40ms' }}>
              <h2 className="card-title">Basic information</h2>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <Field label="Full name" value={name} onChange={setName} placeholder="Dr. Jane Smith" />
                <Field label="Email" value={email} disabled />
              </div>
              <div className="form-grid" style={{ marginTop: 16 }}>
                <div>
                  <label className="form-label" htmlFor="years-exp">Years of experience</label>
                  <input
                    id="years-exp"
                    type="number"
                    min="0"
                    max="60"
                    value={yearsExp}
                    onChange={e => setYearsExp(e.target.value)}
                    placeholder="e.g. 8"
                    className="form-field"
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '80ms' }}>
              <h2 className="card-title">Specialty</h2>
              <p className="form-hint" style={{ marginTop: 8 }}>Patients search and filter by this.</p>
              <div className="chip-row" style={{ marginTop: 16 }} role="group" aria-label="Specialty">
                {SPECIALTIES.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="chip-pick"
                    aria-pressed={specialty === s}
                    onClick={() => setSpecialty(prev => prev === s ? '' : s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label className="form-label" htmlFor="specialty-custom">Or type your own</label>
                <input
                  id="specialty-custom"
                  type="text"
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  placeholder="e.g. Knee Specialist · Sports Injury"
                  className="form-field"
                />
              </div>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '100ms' }}>
              <h2 className="card-title">Hospital affiliations</h2>
              <p className="form-hint" style={{ marginTop: 8 }}>
                Shown as “Available At” on your patient-facing profile.
              </p>
              <div style={{ marginTop: 16 }}>
                <ClinicAffiliations clinics={clinics} onChange={setClinics} />
              </div>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '120ms' }}>
              <h2 className="card-title">Google Calendar</h2>
              <div className="calendar-row" style={{ marginTop: 14 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {googleConnected ? 'Google Calendar connected' : 'Connect your Google Calendar'}
                  </p>
                  <p className="form-hint">
                    {googleConnected
                      ? 'New appointments will automatically create Google Meet links and appear in your calendar.'
                      : 'Let Active Mentor create Google Meet links and calendar events when patients book appointments.'}
                  </p>
                </div>
                <a href={googleHref} className={googleConnected ? 'btn-ghost' : 'btn-copper'}>
                  {googleConnected ? 'Reconnect' : 'Connect'}
                </a>
              </div>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '160ms' }}>
              <h2 className="card-title">About you</h2>
              <label className="sr-only" htmlFor="profile-bio">About you</label>
              <textarea
                id="profile-bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={5}
                placeholder="Describe your clinical approach, areas of focus, or what patients can expect working with you…"
                className="form-area"
                style={{ marginTop: 16 }}
              />
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '200ms' }}>
              <h2 className="card-title">Education and credentials</h2>
              <div className="stack" style={{ marginTop: 16, gap: 12 }}>
                {education.length === 0 ? (
                  <p className="form-hint" style={{ margin: 0 }}>No degrees or certifications yet.</p>
                ) : education.map((entry, i) => (
                  <div key={i} className="edu-card">
                    <button type="button" className="edu-remove" onClick={() => removeEdu(i)} aria-label={`Remove credential ${i + 1}`}>
                      ×
                    </button>
                    <div className="form-grid">
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label" htmlFor={`degree-${i}`}>Degree / certification</label>
                        <input
                          id={`degree-${i}`}
                          type="text"
                          value={entry.degree}
                          placeholder="e.g. Bachelor of Physiotherapy"
                          onChange={e => patchEdu(i, 'degree', e.target.value)}
                          className="form-field"
                        />
                      </div>
                      <div>
                        <label className="form-label" htmlFor={`school-${i}`}>Institution</label>
                        <input
                          id={`school-${i}`}
                          type="text"
                          value={entry.institution}
                          placeholder="University or college"
                          onChange={e => patchEdu(i, 'institution', e.target.value)}
                          className="form-field"
                        />
                      </div>
                      <div>
                        <label className="form-label" htmlFor={`year-${i}`}>Year</label>
                        <input
                          id={`year-${i}`}
                          type="number"
                          value={entry.year}
                          placeholder="2018"
                          min="1950"
                          max="2030"
                          onChange={e => patchEdu(i, 'year', e.target.value)}
                          className="form-field"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn-dashed" onClick={addEdu}>
                + Add degree or certification
              </button>
            </GlassCard>

            <GlassCard className="rise" style={{ animationDelay: '240ms' }}>
              <h2 className="card-title">Account</h2>
              <div className="account-row" style={{ marginTop: 14 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>Sign out of the portal</p>
                  <p className="form-hint">You&apos;ll need to log in again to access your dashboard</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { clearToken(); window.location.href = '/login'; }}
                >
                  Log out
                </button>
              </div>
            </GlassCard>

            {error ? <ErrorState message={error} /> : null}
            {success ? <p className="form-success" role="status">{success}</p> : null}

            <button type="button" className="btn-copper" onClick={handleSave} disabled={saving} style={{ alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder, disabled }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        className="form-field"
      />
      {disabled && <p className="form-hint">Email cannot be changed here</p>}
    </div>
  );
}
