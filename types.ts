/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export interface Artist {
  id: string;
  name: string;
  genre: string;
  image: string;
  day: string;
  description: string;
}

export interface Task {
  id: string;
  title: string;
  deadline: string;
  priority: string;
  category?: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'custom';
  subTasks?: string[];
  status: 'pending' | 'completed';
  estimatedDuration?: number; // in minutes
  createdAt?: string;
  completedAt?: string;
  score?: number;
  scheduledStart?: string;
  aiExplanation?: string;
  locationQuery?: string;
}

export interface SubTask {
  title: string;
  completed: boolean;
}

export interface Habit {
  id: string;
  name: string;
  streak: number;
  completedDays: string[]; // YYYY-MM-DD
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export enum Section {
  HERO = 'hero',
  LINEUP = 'lineup',
  EXPERIENCE = 'experience',
  TICKETS = 'tickets',
}
