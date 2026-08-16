import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { ScheduleTaskComposerComponent } from './schedule-task-composer.component';
import { TaskService } from '../../tasks/task.service';
import { GlobalConfigService } from '../../config/global-config.service';
import { PlannerActions } from '../../planner/store/planner.actions';
import { TaskReminderOptionId } from '../../tasks/task.model';
import { getDbDateStr } from '../../../util/get-db-date-str';

describe('ScheduleTaskComposerComponent', () => {
  let component: ScheduleTaskComposerComponent;
  let fixture: ComponentFixture<ScheduleTaskComposerComponent>;
  let taskService: jasmine.SpyObj<TaskService>;
  let store: jasmine.SpyObj<Store>;

  beforeEach(async () => {
    taskService = jasmine.createSpyObj<TaskService>('TaskService', [
      'add',
      'addAndSchedule',
      'getByIdOnce$',
    ]);
    taskService.add.and.returnValue('created-task');
    taskService.getByIdOnce$.and.returnValue(of({ id: 'created-task' } as any));
    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);

    await TestBed.configureTestingModule({
      imports: [ScheduleTaskComposerComponent],
      providers: [
        { provide: TaskService, useValue: taskService },
        { provide: Store, useValue: store },
        { provide: GlobalConfigService, useValue: { cfg: () => ({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleTaskComposerComponent);
    component = fixture.componentInstance;
  });

  it('plans a date-only task for the clicked day', async () => {
    fixture.componentRef.setInput('day', '2026-08-16');
    component.title.set('准备报告');

    await component.submit();

    expect(store.dispatch).toHaveBeenCalledWith(
      PlannerActions.planTaskForDay({
        task: { id: 'created-task' } as any,
        day: '2026-08-16',
      }),
    );
  });

  it('uses the selected time when scheduling a task', async () => {
    fixture.componentRef.setInput('day', '2026-08-16');
    component.title.set('每日站会');
    component.selectedTime.set('09:30');
    component.selectedReminder.set(TaskReminderOptionId.m15);

    await component.submit();

    expect(taskService.addAndSchedule).toHaveBeenCalledWith(
      '每日站会',
      jasmine.objectContaining({ timeEstimate: 30 * 60 * 1000 }),
      new Date('2026-08-16T09:30').getTime(),
      TaskReminderOptionId.m15,
    );
  });

  it('applies a quick-access date without creating a task', () => {
    component.onQuickAccessClick('tomorrow');

    const expected = new Date();
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() + 1);
    expect(component.selectedDay()).toBe(getDbDateStr(expected));
    expect(taskService.add).not.toHaveBeenCalled();
  });

  it('prevents a duplicate submit after a creation failure', async () => {
    fixture.componentRef.setInput('day', '2026-08-16');
    component.title.set('无法确认的任务');
    component.selectedTime.set('09:30');
    taskService.addAndSchedule.and.rejectWith(new Error('network failed'));
    spyOn(component.closed, 'emit');

    await component.submit();
    await component.submit();

    expect(component.submissionError()).toContain('未确认');
    expect(component.closed.emit).not.toHaveBeenCalled();
    expect(taskService.addAndSchedule).toHaveBeenCalledTimes(1);
  });
});
