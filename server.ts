import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Groq from 'groq-sdk';
import { config } from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local', override: true });
} else {
  config();
}

const apiKey = process.env.GROQ_API_KEY || 'default_key';
const groq = new Groq({ apiKey });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/plan-tasks', async (req, res) => {
    try {
      const { prompt } = req.body;
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      });
      res.json({ itinerary: response.choices[0].message.content });
    } catch (error: any) {
      console.error("Groq Error:", error);
      const errorMessage = error?.message || "Failed to generate plan";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/parse-task', async (req, res) => {
    try {
      const { input } = req.body;
      
      const prompt = `
You are the core intelligence engine for "TaskPulse", an AI-powered productivity companion.
Your primary directive is to move beyond passive reminders and proactively assist users in planning, prioritizing, and completing tasks before deadlines are missed.

When processing user inputs, you must autonomously execute:
- Intelligent Task Prioritization
- AI-Powered Scheduling Assistance
- Autonomous Task Planning
- Context-Aware Reminders

Strict Output & Formatting Constraints:
Your responses will be consumed by a Next.js API route (or equivalent). You must strictly adhere to the following data constraints:
Format: Always return a valid, well-formed JSON object.
Data Structure: Every response must include:
- taskId: A generated unique identifier (string).
- extractedDeadline: ISO 8601 formatted timestamp (string).
- priorityLevel: String (e.g., "CRITICAL", "HIGH", "MODERATE").
- estimatedDuration: Number in minutes for the task to be completed (e.g. 15, 30, 60).
- scheduledStart: ISO 8601 formatted timestamp (string) ONLY IF the user explicitly specifies a time to start or schedule the task. Otherwise, omit this field or return null.
- actionableSubTasks: An array of strings outlining the autonomous task plan.
- uiDirectives: A nested object containing suggested UI states (e.g., {"highlightColor": "electric blue"}).
- aiExplanation: A short, encouraging paragraph explaining the task, why it's important, and a quick tip on how to tackle it.
- locationQuery: (Optional) A string representing a specific physical location or place name if the task inherently requires being at a specific place (e.g. "Whole Foods Market", "Gym", "Dentist clinic"). Only include if the task implies a real-world location context.

Input Task: "${input}"
`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      res.json(JSON.parse(text || '{}'));
    } catch (error: any) {
      console.error("Groq Error:", error);
      const errorMessage = error?.message || "Failed to parse task";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/generate-tasks', async (req, res) => {
    try {
      const { input } = req.body;
      
      const prompt = `
You are the core intelligence engine for "TaskPulse", an AI-powered productivity companion.
The user wants to generate multiple tasks based on a prompt (e.g. "create daily time table for study").

Strict Output & Formatting Constraints:
Your responses will be consumed by a React application. You must strictly adhere to the following data constraints:
Format: Always return a valid, well-formed JSON object containing a "tasks" array.
Each object in the "tasks" array must represent a task and contain:
- title: String (e.g., "Review Math Concepts")
- priorityLevel: String ("CRITICAL", "HIGH", "MODERATE", "LOW")
- estimatedDuration: Number in minutes for the task to be completed (e.g. 15, 30, 60).
- actionableSubTasks: An array of strings outlining the autonomous task plan.

Input Prompt: "${input}"
`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      res.json(JSON.parse(text || '{"tasks":[]}'));
    } catch (error: any) {
      console.error("Groq Error:", error);
      const errorMessage = error?.message || "Failed to generate tasks";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/generate-insights', async (req, res) => {
    try {
      const { tasks, habits } = req.body;
      
      const prompt = `
You are the core intelligence engine for an AI-powered productivity companion.
Analyze the user's tasks and habits, and generate 2-3 personalized, actionable productivity insights or recommendations.

Tasks: ${JSON.stringify(tasks, null, 2)}
Habits: ${JSON.stringify(habits, null, 2)}

Output JSON ONLY in the following format:
{
  "insights": [
    "Insight 1 text",
    "Insight 2 text"
  ]
}
`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      res.json(JSON.parse(text || '{"insights":[]}'));
    } catch (error: any) {
      console.error("Groq Error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate insights" });
    }
  });

  app.post('/api/how-to-complete', async (req, res) => {
    try {
      const { taskTitle } = req.body;
      
      const prompt = `
You are the core intelligence engine for "TaskPulse". 
The user needs help completing the task: "${taskTitle}".
Provide a concise, step-by-step actionable guide (3-5 steps) on how to complete this task. 
Format: Return a valid JSON object containing a "steps" array of strings.
Example: {"steps": ["Step 1...", "Step 2..."]}
`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const text = response.choices[0].message.content;
      res.json(JSON.parse(text || '{"steps":[]}'));
    } catch (error: any) {
      console.error("Groq Error:", error);
      const errorMessage = error?.message || "Failed to generate steps";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, context } = req.body;
      
      const systemPrompt = `You are an AI productivity companion named TaskPulse.
You have context about the user's tasks:
${JSON.stringify(context.tasks, null, 2)}
And habits:
${JSON.stringify(context.habits, null, 2)}

Provide concise, personalized, and actionable advice based on their current tasks and habits. Be encouraging and helpful. Respond in plain text or simple markdown. Keep it relatively brief.`;

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: "Understood. I'm ready to help the user with their productivity." }
      ];

      for (const msg of history) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }

      messages.push({ role: 'user', content: message });

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: messages
      });

      res.json({ reply: response.choices[0].message.content });
    } catch (error: any) {
      console.error("Groq Error:", error);
      res.status(500).json({ error: error?.message || "Failed to process chat" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
