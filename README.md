# Slumberland Document Processing System

A document processing system for managing store documents with OCR capabilities.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **Database**: PostgreSQL

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

## Getting Started

### 1. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

### 2. Start PostgreSQL

```bash
docker-compose up -d
```

### 3. Backend Setup

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

The backend API will be available at `http://localhost:3000`.

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Project Structure

```
/backend
  /src
    /services/        # Business logic
    /routes/          # API endpoints
    /middleware/      # Auth, validation, error handling
    /utils/           # Helpers (logging, validation)
    /types/           # TypeScript types
  /prisma
    schema.prisma     # Database schema
    seed.ts           # Seed data

/frontend
  /src
    /components/      # Reusable UI components
    /pages/           # Page components
    /hooks/           # Custom React hooks
    /api/             # API client
    /types/           # TypeScript types
```

## Available Scripts

### Backend

- `npm run dev` - Start development server with hot reload
- `npm run dev:restart` - Safely kill existing server and restart
- `npm run stop` - Stop the running server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Process Management

The backend uses port-based detection to manage server instances:

- If the port is already in use, `npm run dev` will warn you with the PID
- Use `npm run dev:restart` to safely kill only the process on the port and restart
- Use `npm run stop` to kill the server without restarting

**Note:** These scripts kill only the specific process using the port, not the entire process tree. This prevents accidentally terminating other processes (like IDE terminals or Claude Code sessions).

### Frontend

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Database

The system uses PostgreSQL with Prisma ORM. Key models:

- **document_types** - Document classification codes
- **stores** - Store locations
- **batches** - Original TIFF files with processing status
- **documents** - Logical documents within batches
- **users** - User accounts
- **user_store_access** - Store-level permissions

## License

Proprietary - Slumberland Furniture
