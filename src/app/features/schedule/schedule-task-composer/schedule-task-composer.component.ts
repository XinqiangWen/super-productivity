import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_GLOBAL_CONFIG } from '../../config/default-global-config.const';
import { GlobalConfigService } from '../../config/global-config.service';
import { PlannerActions } from '../../planner/store/planner.actions';
import { TaskService } from '../../tasks/task.service';
import { TaskReminderOptionId } from '../../tasks/task.model';
import { getDbDateStr } from '../../../util/get-db-date-str';
import { parseDbDateStr } from '../../../util/parse-db-date-str';
import { DateTimePickerComponent } from '../../../ui/datetime-picker/datetime-picker.component';

const DEFAULT_TIME_ESTIMATE = 30 * 60 * 1000;

@Component({
  selector: 'schedule-task-composer',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatIcon, DateTimePickerComponent],
  templateUrl: './schedule-task-composer.component.html',
  styleUrl: './schedule-task-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleTaskComposerComponent {
  private readonly _taskService = inject(TaskService);
  private readonly _store = inject(Store);
  private readonly _globalConfigService = inject(GlobalConfigService);

  readonly day = input.required<string>();
  readonly closed = output<void>();
  readonly title = signal('');
  readonly selectedDay = signal('');
  readonly selectedTime = signal<string | null>(null);
  readonly selectedReminder = signal<TaskReminderOptionId>(
    this._globalConfigService.cfg()?.reminder?.defaultTaskRemindOption ??
      DEFAULT_GLOBAL_CONFIG.reminder.defaultTaskRemindOption ??
      TaskReminderOptionId.DoNotRemind,
  );
  readonly isDatePanelOpen = signal(false);
  readonly isSubmitting = signal(false);
  readonly submissionError = signal<string | null>(null);
  readonly titleInput = viewChild<ElementRef<HTMLTextAreaElement>>('titleInput');
  readonly selectedDate = computed(() => {
    const day = this.selectedDay() || this.day();
    return parseDbDateStr(day);
  });

  constructor() {
    afterNextRender(() => {
      this.titleInput()?.nativeElement.focus();
    });
  }

  onDateSelected(date: Date): void {
    this.selectedDay.set(getDbDateStr(date));
  }

  toggleDatePanel(): void {
    this.isDatePanelOpen.update((isOpen) => !isOpen);
  }

  clearDateAndTime(): void {
    this.selectedDay.set(this.day());
    this.selectedTime.set(null);
    this.selectedReminder.set(TaskReminderOptionId.DoNotRemind);
  }

  onQuickAccessClick(option: 'today' | 'tomorrow' | 'nextWeek' | 'nextMonth'): void {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    switch (option) {
      case 'tomorrow':
        date.setDate(date.getDate() + 1);
        break;
      case 'nextWeek':
        date.setDate(date.getDate() + 7);
        break;
      case 'nextMonth':
        date.setDate(1);
        date.setMonth(date.getMonth() + 1);
        break;
    }

    this.onDateSelected(date);
  }

  onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void this.submit();
    }
  }

  async submit(): Promise<void> {
    const title = this.title().trim();
    if (!title || this.isSubmitting() || this.submissionError()) {
      return;
    }

    this.isSubmitting.set(true);
    const day = this.selectedDay() || this.day();
    const additional = { timeEstimate: DEFAULT_TIME_ESTIMATE };

    try {
      if (this.selectedTime()) {
        await this._taskService.addAndSchedule(
          title,
          additional,
          new Date(`${day}T${this.selectedTime()}`).getTime(),
          this.selectedReminder(),
        );
      } else {
        const taskId = this._taskService.add(title, false, additional);
        const task = await firstValueFrom(this._taskService.getByIdOnce$(taskId));
        if (!task) {
          throw new Error('Created task could not be loaded for day planning');
        }
        this._store.dispatch(
          PlannerActions.planTaskForDay({
            task,
            day,
          }),
        );
      }
      this.closed.emit();
    } catch {
      this.submissionError.set('任务创建结果未确认，请先检查日历以避免重复添加。');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!event.defaultPrevented) {
      this.close();
    }
  }
}
