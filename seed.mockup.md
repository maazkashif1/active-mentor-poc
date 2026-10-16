# Mock Data Reference

Recreate anytime (wipes users/sessions/prescriptions/results/chats, then reseeds):

```bash
cd server
node seed.js
```

Patient app API: `https://active-mentor-poc.onrender.com/api`  
Physio portal: set `NEXT_PUBLIC_API_URL` to that same host (not bare localhost) if hitting the shared Render DB.

---

## Physiologist Accounts (Portal)

Password for all: **`Password123`**

| Name | Email | Specialty |
|---|---|---|
| Dr. Ahmed Khan | dr.ahmed.khan@yopmail.com | Knee Specialist · Sports Injury |
| Dr. Sania Ali | dr.sania.ali@yopmail.com | Shoulder Expert · Orthopedic |
| Dr. Omar Farooq | dr.omar.farooq@yopmail.com | Musculoskeletal · Back Care |
| Dr. Fatima Sheikh | dr.fatima.sheikh@yopmail.com | Women's Health · Post-Surgical Rehab |
| Dr. Hassan Malik | dr.hassan.malik@yopmail.com | Sports Physiotherapy · Knee Rehab |
| Dr. Ayesha Nawaz | dr.ayesha.nawaz@yopmail.com | Neurological · Mobility Care |
| Dr. Bilal Ahmad | dr.bilal.ahmad@yopmail.com | Elbow Care · Upper Limb |
| Dr. Zara Hussain | dr.zara.hussain@yopmail.com | Pediatric · Musculoskeletal |
| Dr. Kamran Qureshi | dr.kamran.qureshi@yopmail.com | Pain Management · Orthopedic |
| Dr. Nadia Iqbal | dr.nadia.iqbal@yopmail.com | Ankle · Foot Rehab |
| Dr. Usman Baig | dr.usman.baig@yopmail.com | Cardiopulmonary · Geriatric |
| Dr. Maryam Raza | dr.maryam.raza@yopmail.com | Shoulder Expert · Post-Surgical Rehab |

Each physio includes: specialty, bio, education, clinic(s), schedule, and ~21 days of open slots (`HH:mm`).

Quick smoke logins:
- Portal: `dr.ahmed.khan@yopmail.com` / `Password123`
- App: `asad.malik@yopmail.com` / `Patient123` (knee, Lahore — has chat with Dr. Ahmed)

---

## Patient Accounts (Mobile App)

Password for all: **`Patient123`**

| Name | Email | City | Care Area | Side |
|---|---|---|---|---|
| Asad Malik | asad.malik@yopmail.com | Lahore | Knee | Right |
| Hina Baig | hina.baig@yopmail.com | Karachi | Shoulder | Left |
| Tariq Hussain | tariq.hussain@yopmail.com | Islamabad | Back | Both |
| Amna Siddiqui | amna.siddiqui@yopmail.com | Lahore | Elbow | Right |
| Yusuf Chaudhry | yusuf.chaudhry@yopmail.com | Rawalpindi | Knee | Left |
| Kiran Naz | kiran.naz@yopmail.com | Faisalabad | Wrist | Right |
| Imran Zahid | imran.zahid@yopmail.com | Lahore | Shoulder | Right |
| Sara Rehman | sara.rehman@yopmail.com | Karachi | Ankle | Left |
| Adeel Qureshi | adeel.qureshi@yopmail.com | Islamabad | Back | Both |
| Meera Patel | meera.patel@yopmail.com | Karachi | Knee | Right |
| Faisal Abbas | faisal.abbas@yopmail.com | Multan | Elbow | Left |
| Zainab Khan | zainab.khan@yopmail.com | Lahore | Shoulder | Left |
| Hamza Farhan | hamza.farhan@yopmail.com | Peshawar | Knee | Both |
| Layla Ahmed | layla.ahmed@yopmail.com | Islamabad | Wrist | Left |
| Nadia Butt | nadia.butt@yopmail.com | Rawalpindi | Ankle | Right |
| Ali Hassan | ali.hassan@yopmail.com | Lahore | Back | Both |
| Sofia Mirza | sofia.mirza@yopmail.com | Karachi | Shoulder | Right |
| Usman Tariq | usman.tariq@yopmail.com | Islamabad | Knee | Left |
| Bilal Chishti | bilal.chishti@yopmail.com | Faisalabad | Elbow | Right |
| Mariam Yousaf | mariam.yousaf@yopmail.com | Quetta | Ankle | Both |

---

## Seeded Data Summary

| Entity | Notes |
|---|---|
| Physiologists | 12 with specialty, bio, education, clinics, slots |
| Patients | 20 with city / careArea / side / dob |
| Sessions | ~60–90 across last 14 days (pending / summarised / approved) |
| Prescriptions + results | On approved sessions |
| Chat threads | 3 sample patient↔physio threads |

Photos are empty on purpose — the app uses stable local placeholders until a physio uploads one in the portal.

### Hospital affiliations
Curated logos: Aga Khan, Ziauddin, Shaukat Khanum, South City, Doctors Hospital, National Hospital, PIMS, Services.  
Portal profile: tap curated chips **or** search (Places when `GOOGLE_PLACES_API_KEY` is set; otherwise curated filter).

---

## App ↔ backend wiring checklist

| Feature | Wired |
|---|---|
| Login / register / OTP | Yes |
| Patient profile patch (dob, city, care intake) | Yes |
| Physio list + slots + book | Yes |
| Sessions / prescriptions / progress / results upload | Yes |
| Chat REST + socket | Yes (needs server with chat routes deployed) |
| Physio specialty / education / clinics / photo | Yes (after this seed + profile APIs) |
| Ratings / maps / fake hospital logos | UI-only fallbacks when clinics missing |

**Note:** Redeploy the Render API if it is still on an older build without `clinics`, chat, or image upload. Seed writes to whatever `MONGO_URI` is in `server/.env`.
