import { EventEmitter } from '@tloncorp/shared/utils';

type ProgressManagerEventMap<Task> = {
  complete: (opts: { completed: Set<Task> }) => void;
  progress: (opts: { pending: number; completed: number }) => void;
};

/** Keeps track of pending tasks, resolves when all tasks are completed. */
class ProgressManager<Task> {
  private completedTasks: Set<Task> = new Set();

  emitter = new EventEmitter<ProgressManagerEventMap<Task>>();

  constructor(
    /** Tasks that are not completed - once completed, task is removed from this set */
    private pendingTasks: Set<Task>
  ) {}

  get finished(): boolean {
    return this.pendingTasks.size === 0;
  }

  /** Returns true if task was added; false if task is already pending */
  add(task: Task): boolean {
    if (this.pendingTasks.has(task)) {
      return false; // Task is already pending
    }
    this.pendingTasks.add(task);
    this.updateProgress();
    return true;
  }

  /** Returns false if task was not pending. This method should be used for any
   * completion of the task, including erroring. */
  complete(task: Task): boolean {
    if (this.pendingTasks.delete(task)) {
      this.completedTasks.add(task);
      this.updateProgress();
      return true;
    }
    return false;
  }

  private updateProgress(): void {
    this.emitter.emit('progress', {
      pending: this.pendingTasks.size,
      completed: this.completedTasks.size,
    });

    if (this.pendingTasks.size === 0) {
      this.emitter.emit('complete', { completed: this.completedTasks });
    }
  }
}

export enum SplashScreenTask {
  initialSync = 'initialSync',
  loadTheme = 'loadTheme',
  startDatabase = 'startDatabase',
}

export const splashScreenProgress = new ProgressManager<SplashScreenTask>(
  new Set<SplashScreenTask>([SplashScreenTask.loadTheme])
);
