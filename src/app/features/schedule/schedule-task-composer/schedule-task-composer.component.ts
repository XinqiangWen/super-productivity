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
type DatePanelTab = 'date' | 'timeRange';

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
  readonly selectedEndTime = signal<string | null>(null);
  readonly selectedReminder = signal<TaskReminderOptionId>(
    this._globalConfigService.cfg()?.reminder?.defaultTaskRemindOption ??
      DEFAULT_GLOBAL_CONFIG.reminder.defaultTaskRemindOption ??
      TaskReminderOptionId.DoNotRemind,
  );
  readonly isDatePanelOpen = signal(false);
  readonly activeDatePanelTab = signal<DatePanelTab>('date');
  readonly isSubmitting = signal(false);
  readonly submissionError = signal<string | null>(null);
  readonly hasUncertainSubmissionFailure = signal(false);
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
    this.clearValidationError();
  }

  toggleDatePanel(): void {
    this.isDatePanelOpen.update((isOpen) => !isOpen);
  }

  clearDateAndTime(): void {
    this.selectedDay.set(this.day());
    this.selectedTime.set(null);
    this.selectedEndTime.set(null);
    this.selectedReminder.set(TaskReminderOptionId.DoNotRemind);
    this.clearValidationError();
  }

  selectDatePanelTab(tab: DatePanelTab): void {
    this.activeDatePanelTab.set(tab);
  }

  onTitleChanged(title: string): void {
    this.title.set(title);
    this.clearValidationError();
  }

  onTimeChanged(time: string | null): void {
    this.selectedTime.set(time || null);
    this.clearValidationError();
  }

  onEndTimeChanged(time: string | null): void {
    this.selectedEndTime.set(time || null);
    this.clearValidationError();
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
    if (!title || this.isSubmitting() || this.hasUncertainSubmissionFailure()) {
      return;
    }

    const day = this.selectedDay() || this.day();
    const timeEstimate = this.getTimeEstimate();
    if (timeEstimate === null) {
      this.submissionError.set(
        this.selectedEndTime() && !this.selectedTime()
          ? '请先填写开始时间。'
          : '结束时间必须晚于开始时间。',
      );
      return;
    }

    this.isSubmitting.set(true);
    const additional = { timeEstimate };

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
      this.hasUncertainSubmissionFailure.set(true);
      this.submissionError.set('任务创建结果未确认，请先检查日历以避免重复添加。');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  close(): void {
    this.closed.emit();
  }

  private getTimeEstimate(): number | null {
    const start = this.selectedTime();
    const end = this.selectedEndTime();
    if (!start && !end) {
      return DEFAULT_TIME_ESTIMATE;
    }

    if (start && !end) {
      return DEFAULT_TIME_ESTIMATE;
    }

    if (!start || !end) {
      return null;
    }

    const duration =
      new Date(`2000-01-01T${end}`).getTime() - new Date(`2000-01-01T${start}`).getTime();
    return duration > 0 ? duration : null;
  }

  private clearValidationError(): void {
    if (!this.hasUncertainSubmissionFailure()) {
      this.submissionError.set(null);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!event.defaultPrevented) {
      this.close();
    }
  }
}
