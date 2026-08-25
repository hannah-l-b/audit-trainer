# Audit Training Exercise

This repository contains both conditions of the audit training exercise used in the research study.

## Repository structure

```
audit-training/
├── competitive/
│   └── index.html              ← Competitive condition game
├── no-competition/
│   └── index.html              ← No-competition condition game
├── netlify/
│   └── functions/
│       └── save-result.js      ← Backend that saves data to Supabase
├── netlify.toml                ← Netlify routing and build config
└── README.md
```

## Game links (after deploying to Netlify)

- Competitive:      https://audit-trainer.netlify.app/competitive
- No-competition:   https://audit-trainer.netlify.app/no-competition
- Team:             https://audit-trainer.netlify.app/team

## Setup instructions

### Step 1 — Create a Supabase database (free)

1. Go to supabase.com and create a free account
2. Click "New project" and name it anything (e.g. audit-training)
3. Go to Table Editor → New Table
4. Name the table: results
5. Turn off Row Level Security (RLS)
6. Add the following columns:

   | Column name      | Type        |
   |------------------|-------------|
   | condition        | text        |
   | participant_id   | text        |
   | final_score      | int8        |
   | correct_answers  | int8        |
   | total_questions  | int8        |
   | accuracy         | int8        |
   | max_streak       | int8        |
   | total_time       | int8        |
   | timed_out_count  | int8        |
   | question_log     | jsonb       |

   (id and created_at are added automatically)

7. Go to Project Settings → API
8. Copy the "Project URL" and the "anon public" key

### Step 2 — Add your Supabase credentials

Open `netlify/functions/save-result.js` and replace:
- `YOUR_SUPABASE_URL_HERE` with your Project URL
- `YOUR_SUPABASE_ANON_KEY_HERE` with your anon public key

Commit and push to GitHub.

### Step 3 — Deploy via Netlify

1. Go to netlify.com and sign in
2. Click Add new site → Import from Git → GitHub
3. Select this repository
4. Netlify auto-detects netlify.toml — just click Deploy
5. Both game links are live immediately

### Step 4 — Pass participant IDs from Qualtrics

Add `?pid=${e://Field/ResponseID}` to each game URL so each session is tagged with the Qualtrics response ID.

- `https://your-site.netlify.app/competitive?pid=${e://Field/ResponseID}`
- `https://your-site.netlify.app/no-competition?pid=${e://Field/ResponseID}`

## Downloading your data

Go to your Supabase project → Table Editor → results → click the download button to export as CSV.
