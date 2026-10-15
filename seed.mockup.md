# Mock Data Reference

All test accounts use simple passwords. Recreate at any time: `node server/seed.js`

---

## Physiologist Accounts (Portal)

Portal: `http://localhost:5173`  
Password for all: **`Password123`**

| Name | Email |
|---|---|
| Dr. Ahmed Khan | dr.ahmed.khan@yopmail.com |
| Dr. Sania Ali | dr.sania.ali@yopmail.com |
| Dr. Omar Farooq | dr.omar.farooq@yopmail.com |
| Dr. Fatima Sheikh | dr.fatima.sheikh@yopmail.com |
| Dr. Hassan Malik | dr.hassan.malik@yopmail.com |
| Dr. Ayesha Nawaz | dr.ayesha.nawaz@yopmail.com |
| Dr. Bilal Ahmad | dr.bilal.ahmad@yopmail.com |
| Dr. Zara Hussain | dr.zara.hussain@yopmail.com |
| Dr. Kamran Qureshi | dr.kamran.qureshi@yopmail.com |
| Dr. Nadia Iqbal | dr.nadia.iqbal@yopmail.com |
| Dr. Usman Baig | dr.usman.baig@yopmail.com |
| Dr. Maryam Raza | dr.maryam.raza@yopmail.com |

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

## Seeded Data Summary (last run: 2026-10-15)

| Entity | Count |
|---|---|
| Patients | 20 |
| Sessions (total) | 83 |
| — Approved | ~50 |
| — Awaiting Review | ~14 |
| — Pending | ~19 |
| Prescriptions | 50 |
| Exercise Results | 90 |
| Future physio slots | ~430 (next 14 days) |

Sessions are spread across the **last 14 days** so the dashboard bar chart shows activity.  
Each approved session has 1–3 exercise results with AI summaries, ROM%, and consistency scores.

---

## Re-seeding

```bash
cd server
node seed.js
```

The script is idempotent for patients (skips existing emails) and deletes/recreates sessions on every run.
