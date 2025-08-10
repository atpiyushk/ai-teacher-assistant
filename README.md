# AISensei

**AI‑powered teacher assistant** for creating, distributing, and grading assignments using FastAPI, Next.js, and Large Language Models.

---

## Features

- **Authentication**: Google OAuth2 & email/password with JWT (access & refresh tokens)  
- **User Roles**: Teachers and students with separate portals  
- **Classroom Management**: Sync with Google Classroom or create manually  
- **Assignments & Submissions**: Create assignments, upload student work, track statuses  
- **AI Grading**: Automated grading using Google Gemini / OpenAI APIs  
- **Background Tasks**: Async grading with Celery + Redis  
- **Database Migrations**: Schema evolution via Alembic  
- **Caching & Pub/Sub**: Redis for caching and real‑time updates  
- **Frontend**: Next.js 15 + Tailwind CSS with TypeScript  
- **Real‑time**: WebSocket integration for live grading updates  

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | FastAPI, SQLAlchemy, PostgreSQL     |
| Migrations  | Alembic                             |
| Auth        | OAuth2 (Google), JWT, Passlib       |
| Tasks       | Celery, Redis                       |
| AI Services | Google Gemini, OpenAI (optional)    |
| Frontend    | Next.js 15, React, Tailwind CSS     |
| DevOps      | Docker, Docker Compose, Kubernetes  |

---

## Project Structure

```
ai-teacher-assist-main/
├── backend-python/        # FastAPI app
│   ├── app/
│   ├── alembic/           # Migrations
│   ├── Dockerfile
│   └── docker-compose.yml
├── client/                # Next.js frontend
│   ├── src/app/
│   └── tailwind.config.mjs
├── README.md              # (this file)
└── .gitignore
```

---

## Backend Setup

1. **Create & activate venv**  
   ```bash
   cd backend-python
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**  
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment**  
   Copy `.env.example` to `.env` and set variables (`DATABASE_URL`, `REDIS_URL`, `GOOGLE_CLIENT_ID`, etc.)

4. **Run database & services**  
   ```bash
   docker-compose up -d postgres redis
   alembic upgrade head
   ```

5. **Start the API**  
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

## Frontend Setup

1. **Install packages**  
   ```bash
   cd client
   npm install
   ```

2. **Configure local env**  
   Create `.env.local` with API base URL (e.g., `NEXT_PUBLIC_API_URL=http://localhost:8000`)

3. **Run dev server**  
   ```bash
   npm run dev
   ```

---

## Scripts & Commands

**Backend**  
- `uvicorn app.main:app` — start API  
- `alembic revision --autogenerate` — create migration  
- `alembic upgrade head` — apply migrations  

**Frontend**  
- `npm run dev` — start Next.js in development  
- `npm run build && npm start` — production build & start  

---

## Contributing

1. Fork the repo  
2. Create a feature branch (`git checkout -b feature/...`)  
3. Commit your changes  
4. Open a Pull Request  

---

## License

MIT License