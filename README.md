# TaskPulse

TaskPulse is an AI-powered task management and productivity dashboard designed to help you organize your daily goals, track habits, and manage projects effectively. With its modern, glassmorphism-inspired UI and powerful features like Deep Focus Mode, TaskPulse ensures you stay on top of your tasks.

## Features

- **AI Task Assistant**: Seamlessly generate, organize, and track your tasks using AI insights.
- **Deep Focus Mode**: A distraction-free mode to focus on a single task, complete with lo-fi beats, task checklists, and an immersive timer.
- **Bento Dashboard**: Fully customizable, drag-and-drop asymmetric grid to prioritize the widgets that matter most to you.
- **Smart Task Management**: Advanced filters, intelligent sorting, and full drag-and-drop support.
- **Activity Tracking**: Track your daily goals, habits, and productivity streaks.
- **Google Calendar Integration**: View upcoming events directly from your dashboard.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- dnd-kit
- Firebase (Auth, Firestore)
- Express (Backend API server)
- Gemini API

## Prerequisites

- Node.js (v22+)
- Firebase Project
- Google Gemini API Key

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/taskpulse.git
   cd taskpulse
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   
   Copy `.env.example` to `.env` and fill in the required keys.

   ```bash
   cp .env.example .env
   ```

   You'll need to provide your Gemini API key and Firebase configuration if you want to use authentication and cloud features.

4. **Run the Development Server:**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`.

## Building for Production

To build the application for production:

```bash
npm run build
```

Then start the production server:

```bash
npm run start
```

## License

This project is licensed under the MIT License.
