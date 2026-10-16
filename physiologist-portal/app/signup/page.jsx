'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken, setUserName } from '../../lib/api';
import logoImg from '../../logo.png';

const TOTAL_STEPS = 3;

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              done   ? 'bg-[#DA7235] text-white' :
              active ? 'bg-[#DA7235]/20 border border-[#DA7235] text-[#DA7235]' :
                       'bg-white/5 border border-white/10 text-white/30'
            }`}>
              {n}
            </div>
            {n < TOTAL_STEPS && (
              <div className={`h-px w-10 transition-colors ${done ? 'bg-[#DA7235]' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Account details ──────────────────────────────────────────────────
function StepAccount({ data, onChange, error, onNext }) {
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const validate = () => {
    if (!data.name.trim())  return 'Full name is required';
    if (!data.email.trim()) return 'Email is required';
    if (data.password.length < 8) return 'Password must be at least 8 characters';
    if (data.password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError('');
    onNext();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Create your account</h2>
        <p className="text-white/40 text-sm mt-1">Your login credentials for the portal</p>
      </div>

      <Field label="Full name" type="text" value={data.name} placeholder="Dr. Sarah Mitchell"
        onChange={v => onChange('name', v)} />
      <Field label="Email" type="email" value={data.email} placeholder="you@clinic.com"
        onChange={v => onChange('email', v)} />
      <Field label="Password" type="password" value={data.password} placeholder="Min. 8 characters"
        onChange={v => onChange('password', v)} />
      <Field label="Confirm password" type="password" value={confirm} placeholder="Repeat password"
        onChange={setConfirm} />

      {(localError || error) && <p className="text-red-400 text-sm">{localError || error}</p>}

      <button onClick={handleNext}
        className="w-full py-2.5 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors">
        Next →
      </button>
    </div>
  );
}

// ── Step 2: Professional profile ─────────────────────────────────────────────
function StepProfile({ data, onChange, onNext, onBack }) {
  const [localError, setLocalError] = useState('');

  const handleNext = () => {
    if (!data.specialty.trim()) {
      setLocalError('Specialty is required — patients filter and browse by this.');
      return;
    }
    setLocalError('');
    onNext();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Professional profile</h2>
        <p className="text-white/40 text-sm mt-1">Patients see this when they browse physiologists</p>
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Specialty *</label>
        <input
          type="text"
          value={data.specialty}
          onChange={e => onChange('specialty', e.target.value)}
          placeholder="e.g. Knee Specialist · Sports Injury"
          className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235]"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">Years of experience</label>
        <input
          type="number" min="0" max="60"
          value={data.yearsExperience}
          onChange={e => onChange('yearsExperience', e.target.value)}
          placeholder="e.g. 8"
          className="w-32 rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235]"
        />
      </div>

      <div>
        <label className="block text-sm text-white/60 mb-1">About you</label>
        <textarea
          value={data.bio}
          onChange={e => onChange('bio', e.target.value)}
          rows={4}
          placeholder="Brief description of your approach, methods, or what makes your practice unique…"
          className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235] resize-none"
        />
      </div>

      <div className="rounded-lg border border-white/10 p-4 space-y-3">
        <p className="text-sm text-white/60">Clinic / practice (shown as “Available At”)</p>
        <Field label="Clinic name" type="text" value={data.clinicName} placeholder="e.g. Aga Khan University Hospital"
          onChange={v => onChange('clinicName', v)} />
        <Field label="Branch / campus" type="text" value={data.clinicBranch} placeholder="e.g. Garden · Diagnostic Centre"
          onChange={v => onChange('clinicBranch', v)} />
        <Field label="Address / city" type="text" value={data.clinicAddress} placeholder="e.g. Karachi"
          onChange={v => onChange('clinicAddress', v)} />
      </div>

      {localError && <p className="text-red-400 text-sm">{localError}</p>}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors">
          ← Back
        </button>
        <button onClick={handleNext}
          className="flex-1 py-2.5 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Education & submit ───────────────────────────────────────────────
function StepEducation({ education, onAdd, onRemove, onChange, onBack, onSubmit, submitting, error }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Education & credentials</h2>
        <p className="text-white/40 text-sm mt-1">Add your degrees, certifications, or training</p>
      </div>

      {education.map((entry, i) => (
        <div key={i} className="rounded-lg border border-white/10 p-4 space-y-3 relative">
          <button type="button" onClick={() => onRemove(i)}
            className="absolute top-3 right-3 text-white/20 hover:text-red-400 text-lg leading-none">×</button>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-white/40 mb-1">Degree / Certification</label>
              <input type="text" value={entry.degree} placeholder="e.g. Bachelor of Physiotherapy"
                onChange={e => onChange(i, 'degree', e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#DA7235]" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Institution</label>
              <input type="text" value={entry.institution} placeholder="University / College"
                onChange={e => onChange(i, 'institution', e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#DA7235]" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Year</label>
              <input type="number" value={entry.year} placeholder="2018" min="1950" max="2030"
                onChange={e => onChange(i, 'year', e.target.value)}
                className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#DA7235]" />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={onAdd}
        className="w-full py-2 rounded-lg border border-dashed border-white/20 text-white/40 hover:border-[#DA7235]/50 hover:text-[#DA7235] text-sm transition-colors">
        + Add degree or certification
      </button>

      <p className="text-white/30 text-xs text-center">
        Education is optional — you can add more from your profile later.
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack}
          className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors">
          ← Back
        </button>
        <button onClick={onSubmit} disabled={submitting}
          className="flex-1 py-2.5 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </div>
    </div>
  );
}

// ── Shared field component ───────────────────────────────────────────────────
function Field({ label, type, value, placeholder, onChange }) {
  return (
    <div>
      <label className="block text-sm text-white/60 mb-1">{label}</label>
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg bg-white/10 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-[#DA7235]" />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [account, setAccount] = useState({ name: '', email: '', password: '' });
  const [profile, setProfile] = useState({
    specialty: '', yearsExperience: '', bio: '',
    clinicName: '', clinicBranch: '', clinicAddress: '',
  });
  const [education, setEducation] = useState([]);

  const patchAccount = (k, v) => setAccount(prev => ({ ...prev, [k]: v }));
  const patchProfile = (k, v) => setProfile(prev => ({ ...prev, [k]: v }));

  const addEducation = () =>
    setEducation(prev => [...prev, { degree: '', institution: '', year: '' }]);

  const removeEducation = (i) =>
    setEducation(prev => prev.filter((_, idx) => idx !== i));

  const patchEducation = (i, k, v) =>
    setEducation(prev => prev.map((e, idx) => idx === i ? { ...e, [k]: v } : e));

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Clean up education — drop empty rows
      const cleanedEdu = education.filter(e => e.degree || e.institution);

      const clinics = (profile.clinicName || profile.clinicBranch)
        ? [{
            name: profile.clinicName.trim(),
            branch: profile.clinicBranch.trim(),
            address: profile.clinicAddress.trim(),
          }]
        : [];

      await api.post('/api/users/register', {
        name: account.name,
        email: account.email,
        password: account.password,
        role: 'physiologist',
        yearsExperience: profile.yearsExperience ? Number(profile.yearsExperience) : undefined,
        specialty: profile.specialty,
        bio: profile.bio,
        education: cleanedEdu,
        clinics,
      });

      // Auto-login after registration
      const loginData = await api.post('/api/users/login', {
        email: account.email,
        password: account.password,
      });
      setToken(loginData.token);
      setUserName(account.name);
      router.push('/availability?onboarding=1');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen py-12">
      <div className="w-full max-w-md px-6">
        <div className="mb-6 flex justify-center">
          <img src={logoImg.src} alt="Active Mentor" className="h-12 w-auto" />
        </div>

        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
          <StepIndicator current={step} />

          {step === 1 && (
            <StepAccount
              data={account}
              onChange={patchAccount}
              error={error}
              onNext={() => { setError(''); setStep(2); }}
            />
          )}
          {step === 2 && (
            <StepProfile
              data={profile}
              onChange={patchProfile}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepEducation
              education={education}
              onAdd={addEducation}
              onRemove={removeEducation}
              onChange={patchEducation}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={error}
            />
          )}
        </div>

        <p className="text-center text-white/30 text-sm mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#DA7235] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
