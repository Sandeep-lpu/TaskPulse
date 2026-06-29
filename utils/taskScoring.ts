import { Task } from '../types';

export function calculateTaskScore(task: Task): number {
  let score = 0;
  const now = new Date();
  const deadline = new Date(task.deadline);
  
  // 1. Urgency (Proximity to due date)
  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursUntilDeadline < 0) {
    score += 100; // Overdue
  } else if (hoursUntilDeadline <= 24) {
    score += 80; // Due within a day
  } else if (hoursUntilDeadline <= 72) {
    score += 50; // Due within 3 days
  } else {
    score += 20; // Due later
  }

  // 2. Importance (User-assigned priority)
  const priorityWeights: Record<string, number> = {
    CRITICAL: 50,
    HIGH: 40,
    MODERATE: 20,
    LOW: 10
  };
  score += priorityWeights[task.priority?.toUpperCase()] || 10;

  // 3. Quick Wins (Estimated duration)
  if (task.estimatedDuration && task.estimatedDuration <= 15) {
    score += 15; // Quick win bonus
  } else if (task.estimatedDuration && task.estimatedDuration <= 30) {
    score += 10;
  } else if (task.estimatedDuration && task.estimatedDuration > 120) {
    score -= 10; // Large task penalty (needs breaking down)
  }

  return score;
}

export function sortTasksIntelligently(tasks: Task[]): Task[] {
  return tasks
    .map(task => ({
      ...task,
      score: calculateTaskScore(task)
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
