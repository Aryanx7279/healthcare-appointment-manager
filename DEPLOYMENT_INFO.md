# CareFlow Deployment Instructions

Follow these instructions to deploy your application to Vercel (Frontend) and Railway (Backend).

---

## 1. Backend Deployment on Railway

1. Go to **[Railway.app](https://railway.app)** and log in.
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository: `Aryanx7279/healthcare-appointment-manager`.
4. Choose the `backend` folder as the root directory of the service (under Service Settings).
5. In the **Variables** tab, add the following Environment Variables:

| Variable Name | Recommended Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Production environment mode |
| `PORT` | `5000` | Port for the express app |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_Vy8TxOW2aCIu@ep-crimson-pond-ax2pa32n-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Database Connection String |
| `JWT_SECRET` | `dev-jwt-secret-change-in-production-must-be-at-least-32-chars` | Secret key for access token generation |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-change-in-production` | Secret key for refresh tokens |
| `JWT_EXPIRES_IN` | `15m` | Access token duration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token duration |
| `ENABLE_REDIS` | `false` | Disable Redis background worker (uses DB fallback) |
| `SMTP_HOST` | `smtp.resend.com` | SMTP Host for Resend |
| `SMTP_PORT` | `587` | SMTP Port |
| `SMTP_SECURE` | `false` | TLS Mode |
| `SMTP_USER` | `resend` | SMTP User |
| `SMTP_PASS` | `re_your_resend_api_key` | Resend API Key |
| `SMTP_FROM` | `CareFlow <onboarding@resend.dev>` | Email sender address |
| `OPENAI_API_KEY` | `gsk_your_groq_api_key` | Groq API Key |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` | Groq Base API URL |
| `OPENAI_MODEL` | `llama-3.1-8b-instant` | Groq LLM model name |
| `FRONTEND_URL` | *(your Vercel frontend URL, e.g. `https://healthcare-appointment-manager-three.vercel.app`)* | URL of your deployed frontend (for CORS security) |

---

## 2. Frontend Deployment on Vercel

1. Go to **[Vercel.com](https://vercel.com)** and log in.
2. Click **"Add New"** -> **"Project"**.
3. Import your GitHub repository: `Aryanx7279/healthcare-appointment-manager`.
4. In the configuration settings:
   - Set the **Root Directory** to `frontend`.
   - Set the **Framework Preset** to **Vite** (auto-detected).
5. Expand **Environment Variables** and add:

| Key | Value | Description |
|---|---|---|
| `VITE_API_URL` | *(your Railway backend URL + `/api`, e.g., `https://healthcare-appointment-manager-production.up.railway.app/api`)* | API endpoint for the React client |

6. Click **Deploy**.

---

### Post-Deployment Step:
Once both Vercel and Railway have deployed successfully, remember to update the `FRONTEND_URL` variable in your **Railway** dashboard to point to your new Vercel URL (e.g. `https://xxxx.vercel.app`) to ensure CORS policies permit frontend requests.
