'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import ErrorState from '../../components/ui/ErrorState';
import { ProfileSkeleton } from '../../components/ui/Skeletons';
import { api, getToken, clearToken, setUserName } from '../../lib/api';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [yearsExp, setYearsExp] = useState('');
  const [bio, setBio] = useState('');
  const [education, setEducation] = useState([]);
  const [googleConnected, setGoogleConnected] = useState(false);

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
  }, [router]);

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

  const googleHref = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/google?token=${getToken()}`;

  return (
    <AppShell>
      <div className="profile-wrap">
        <PageHeader title="Profile" subtitle="Your clinical profile" />

        {loading ? (
          <GlassCard className="rise">
            <ProfileSkeleton />
          </GlassCard>
        ) : (
          <div className="stack">
            <GlassCard className="rise">
              <div className="profile-id">
                <span className="avatar avatar-lg" aria-hidden="true">{initials(name)}</span>
                <div>
                  <h2>{name || '—'}</h2>
                  <p className="page-sub">{email || 'No email on file'}</p>
                  {specialization ? <span className="spec-pill">{specialization}</span> : null}
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
              <h2 className="card-title">Specialization</h2>
              <div className="chip-row" style={{ marginTop: 16 }} role="group" aria-label="Specialization">
                {SPECIALIZATIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="chip-pick"
                    aria-pressed={specialization === s}
                    onClick={() => setSpecialization(prev => prev === s ? '' : s)}
                  >
                    {s}
                  </button>
                ))}
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
