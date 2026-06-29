import { Task } from '../types';

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface ScheduleConfig {
  workingHours: { start: string; end: string }; // e.g. "09:00", "17:00"
  focusPeriods?: TimeSlot[]; // times where high priority/deep work should go
}

export interface AssignedBlock {
  task: Task;
  slot: TimeSlot;
}

// Helper to parse HH:mm to today's date
export function parseTime(timeStr: string, baseDate = new Date()): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Calculates available gaps
export function calculateAvailableGaps(occupiedSlots: TimeSlot[], workingHours: ScheduleConfig['workingHours'], date = new Date()): TimeSlot[] {
  const startOfDay = parseTime(workingHours.start, date);
  const endOfDay = parseTime(workingHours.end, date);

  const sortedOccupied = [...occupiedSlots].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  const gaps: TimeSlot[] = [];
  let currentStart = startOfDay;

  for (const slot of sortedOccupied) {
    if (currentStart < slot.start) {
      gaps.push({ start: currentStart, end: slot.start });
    }
    if (currentStart < slot.end) {
      currentStart = slot.end;
    }
  }

  if (currentStart < endOfDay) {
    gaps.push({ start: currentStart, end: endOfDay });
  }

  return gaps;
}

// Assign tasks to slots based on estimated duration
export function assignTasksToSlots(tasks: Task[], gaps: TimeSlot[], focusPeriods: TimeSlot[] = []): AssignedBlock[] {
  // Create a mutable copy of gaps
  const availableGaps = [...gaps.map(g => ({ ...g }))];
  const assignments: AssignedBlock[] = [];
  
  // Assume tasks are already sorted by priority/score
  for (const task of tasks) {
    if (!task.estimatedDuration) continue;
    const durationMs = task.estimatedDuration * 60 * 1000;

    // Try to find a gap that fits the duration
    for (let i = 0; i < availableGaps.length; i++) {
      const gap = availableGaps[i];
      const gapDuration = gap.end.getTime() - gap.start.getTime();

      if (gapDuration >= durationMs) {
        // Assign task
        const blockStart = new Date(gap.start);
        const blockEnd = new Date(gap.start.getTime() + durationMs);
        
        assignments.push({
          task,
          slot: { start: blockStart, end: blockEnd }
        });

        // Shrink the gap
        gap.start = blockEnd;
        break;
      }
    }
  }

  return assignments;
}

// Prompt generator
export function generateItineraryPrompt(tasks: Task[], assignments: AssignedBlock[], occupiedSlots: TimeSlot[]): string {
  return `
You are the core intelligence engine for "TaskPulse", an AI-powered productivity companion.
Below is the user's raw schedule data for today, including their assigned task blocks and fixed meetings (occupied slots).

Assigned Task Blocks:
${assignments.map(a => `- [${a.slot.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${a.slot.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] ${a.task.title} (Priority: ${a.task.priority})`).join('\n')}

Fixed Meetings / Occupied Slots:
${occupiedSlots.map(s => `- [${s.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${s.end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] Busy/Meeting`).join('\n')}

Tasks that couldn't be scheduled today (Backlog):
${tasks.filter(t => !assignments.find(a => a.task.id === t.id)).map(t => `- ${t.title}`).join('\n')}

Based on this data, please generate a highly readable, encouraging, and human-friendly daily itinerary.
Highlight deep work sessions and proactively suggest short breaks between intensive tasks. 
Do not just list the schedule; provide a brief narrative on how to approach the day to maximize productivity and avoid burnout, acknowledging their priorities and estimated durations.
`;
}
