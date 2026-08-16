import { TestBed } from '@angular/core/testing';
import { deviceType } from 'detect-it';
import { BodyClass } from '../../app.constants';
import { IS_TOUCH_PRIMARY } from '../../util/is-mouse-primary';
import { InputIntentService, _inputIntentSignal } from './input-intent.service';

describe('InputIntentService', () => {
  beforeEach(() => {
    _inputIntentSignal.set('mouse');
  });

  it('should be injectable', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(InputIntentService);
    expect(service).toBeTruthy();
  });

  it('should expose currentIntent as readonly signal', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(InputIntentService);
    expect(service.currentIntent()).toBe('mouse');
  });

  it('should not modify body classes on mouseOnly devices, only write the initial class otherwise', () => {
    // detect-it evaluates the physical device, so a touch-capable Windows host
    // runs this spec as hybrid; assert the documented behavior for both cases.
    document.body.classList.remove(BodyClass.isMousePrimary, BodyClass.isTouchPrimary);
    const beforeClasses = Array.from(document.body.classList);
    TestBed.configureTestingModule({});
    TestBed.inject(InputIntentService);
    const afterClasses = Array.from(document.body.classList);

    if (deviceType === 'mouseOnly') {
      expect(afterClasses).toEqual(beforeClasses);
    } else {
      expect(afterClasses).toEqual([
        ...beforeClasses,
        IS_TOUCH_PRIMARY ? BodyClass.isTouchPrimary : BodyClass.isMousePrimary,
      ]);
    }

    document.body.classList.remove(BodyClass.isMousePrimary, BodyClass.isTouchPrimary);
  });

  describe('_inputIntentSignal', () => {
    it('should default to mouse', () => {
      expect(_inputIntentSignal()).toBe('mouse');
    });

    it('should be writable', () => {
      _inputIntentSignal.set('touch');
      expect(_inputIntentSignal()).toBe('touch');
      _inputIntentSignal.set('mouse');
      expect(_inputIntentSignal()).toBe('mouse');
    });
  });
});
