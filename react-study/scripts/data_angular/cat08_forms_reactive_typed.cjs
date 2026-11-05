const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 85,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Strictly Typed Reactive Forms (FormGroup, FormControl)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Strictly Typed Reactive Forms in Angular, and how do they eliminate `any` type casting?",
    quickAnswer: "Introduced in Angular 14, typed forms enforce strict TypeScript models across `FormControl<T>`, `FormGroup<T>`, and `FormArray<T>`. Accessing `form.value`, `form.get('field')`, or calling `setValue()` provides full autocomplete and compile-time type safety without casting.",
    detailedAnswer: "Historically, Angular reactive forms were untyped; `form.value` was typed as `any`, causing runtime bugs if fields were renamed or values were mismatched. Typed forms define a TypeScript interface corresponding to the form shape. Properties on `form.controls` are strongly typed, and `form.value` produces a partial type (accounting for disabled controls). If dynamic keys are needed, `FormRecord<FormControl<T>>` provides type safety for open-ended key-value dictionaries.",
    code: `import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
  rememberMe: FormControl<boolean>;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="email" type="email" />
      <input formControlName="password" type="password" />
      <button [disabled]="form.invalid">Login</button>
    </form>
  \`
})
export class LoginComponent {
  // Strongly typed FormGroup
  form = new FormGroup<LoginForm>({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    rememberMe: new FormControl(false, { nonNullable: true })
  });

  onSubmit() {
    // form.getRawValue() produces: { email: string, password: string, rememberMe: boolean }
    const credentials = this.form.getRawValue();
    console.log(credentials.email); // Autocomplete and type safe!
  }
}`,
    recallHint: "Typed forms enforce type safety across FormControl<T>, FormGroup<T>, eliminating any casting.",
    interviewTip: "Explain the difference between `form.value` and `form.getRawValue()`: `form.value` omits disabled controls, whereas `form.getRawValue()` returns all controls including disabled ones.",
    tags: ["typed-forms", "reactive-forms", "typescript", "forms"],
    practice: [
      "Why is `form.value.field` typed as `T | undefined` when controls can be disabled?",
      "When should you use `FormRecord` instead of `FormGroup`?"
    ]
  }),

  createCard({
    idNum: 86,
    category: "Typed Forms & ControlValueAccessor",
    concept: "NonNullableFormBuilder & nonNullable Controls",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does `FormControl.reset()` revert value to `null` by default, and how does `nonNullable` or `NonNullableFormBuilder` prevent this?",
    quickAnswer: "By default, calling `control.reset()` sets its value to `null`, changing its type to `T | null`. Specifying `{ nonNullable: true }` (or using `NonNullableFormBuilder`) causes `reset()` to revert the control back to its initial default value instead of `null`.",
    detailedAnswer: "In standard TypeScript strict null checks, if a form control starts with `''` (string) but calling `.reset()` makes it `null`, its type is forced to `string | null`. This requires repetitive null checks throughout your code. Using `nonNullable: true` instructs Angular to store the initial value; when `.reset()` is called, the control resets to that initial value, preserving `FormControl<string>` purity.",
    code: `import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <input [formControl]="searchControl" placeholder="Search..." />
    <button (click)="searchControl.reset()">Reset</button>
  \`
})
export class SearchFormComponent {
  // Inject the NonNullableFormBuilder (nnfb)
  private fb = inject(NonNullableFormBuilder);

  // searchControl is strictly FormControl<string>, NEVER null!
  searchControl = this.fb.control('initial search term', [Validators.required]);

  resetAction() {
    this.searchControl.reset();
    // Value is 'initial search term', NOT null!
    console.log(this.searchControl.value.length);
  }
}`,
    recallHint: "nonNullable: true / NonNullableFormBuilder resets controls to initial value instead of null.",
    interviewTip: "Always recommend `NonNullableFormBuilder` for modern enterprise forms to keep types clean and prevent `null` checking clutter.",
    tags: ["typed-forms", "nonnullable", "formbuilder", "forms"],
    practice: [
      "What is the difference between `FormBuilder` and `NonNullableFormBuilder`?",
      "Can you pass a custom reset value to `control.reset('new fallback')`?"
    ]
  }),

  createCard({
    idNum: 87,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Custom Synchronous Validators (ValidatorFn)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you write a custom synchronous `ValidatorFn` in Angular, and what should it return on success vs failure?",
    quickAnswer: "A `ValidatorFn` accepts an `AbstractControl` and returns `ValidationErrors | null`. On success, it must return `null`. On failure, it returns an error object (e.g. `{ forbiddenName: { value: control.value } }`).",
    detailedAnswer: "Custom validators enforce business constraints (e.g. prohibited words, specific regex patterns, number ranges). A validator factory function can accept configuration parameters (like a forbidden string) and return the `ValidatorFn` closure. The returned error object keys are accessible on `control.errors?.['forbiddenName']` for rendering validation error messages in templates.",
    code: `import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// 1. Validator Factory:
export function forbiddenNameValidator(forbidden: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Empty values pass (use Validators.required for emptiness)
    }
    const isForbidden = forbidden.test(control.value);
    return isForbidden ? { forbiddenName: { value: control.value } } : null;
  };
}

// 2. Usage in component:
import { FormControl } from '@angular/forms';

const usernameControl = new FormControl('', {
  validators: [forbiddenNameValidator(/admin|root|superuser/i)]
});`,
    recallHint: "ValidatorFn: returns null on valid; returns { [errorKey]: details } on invalid.",
    interviewTip: "Always check if `!control.value` at the start of a custom validator and return `null` if empty. Validation for presence should be handled by `Validators.required` independently.",
    tags: ["validators", "validatorfn", "reactive-forms", "validation"],
    practice: [
      "Why should a custom validator return `null` if the control value is empty?",
      "How do you access custom validator error details in template `@if (control.errors?.['forbiddenName'])`?"
    ]
  }),

  createCard({
    idNum: 88,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Custom Asynchronous Validators (AsyncValidatorFn)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement an `AsyncValidatorFn` (e.g. checking username uniqueness via HTTP), and how do you prevent race conditions?",
    quickAnswer: "An `AsyncValidatorFn` returns `Observable<ValidationErrors | null> | Promise<ValidationErrors | null>`. To prevent spamming HTTP endpoints on every keystroke and avoid race conditions, debounce using `timer()`, switch to the HTTP call using `switchMap()`, and take the first emission using `take(1)` or `first()`.",
    detailedAnswer: "Asynchronous validators run after synchronous validators pass. While running, the control status is `PENDING`. Because HTTP calls are slow, an async validator must emit only when the server responds and MUST complete (`take(1)`). Using `timer(300).pipe(switchMap(...))` ensures that prior inflight requests are canceled when the user types another character, preventing race conditions.",
    code: `import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, timer, of } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

export function uniqueUsernameValidator(http: HttpClient): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value) {
      return of(null);
    }

    // Debounce HTTP call by 300ms using RxJS timer:
    return timer(300).pipe(
      switchMap(() => http.get<{ isAvailable: boolean }>(\`/api/users/check?name=\${control.value}\`)),
      map(res => (res.isAvailable ? null : { usernameTaken: true })),
      catchError(() => of(null)), // Graceful fallback on network error
      take(1) // Essential: must complete!
    );
  };
}`,
    recallHint: "AsyncValidatorFn returns Observable<ValidationErrors | null>. Must complete (take(1)) and debounce via timer/switchMap.",
    interviewTip: "Highlight that if an Observable returned by an async validator does not complete (`take(1)`), the form control will remain stuck in `PENDING` status forever.",
    tags: ["async-validator", "rxjs", "http", "forms"],
    practice: [
      "Why must the Observable returned by an AsyncValidator complete?",
      "How do you style inputs during the `PENDING` validation phase (e.g. showing a loading spinner)?"
    ]
  }),

  createCard({
    idNum: 89,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Cross-Field Validation on FormGroup",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement Cross-Field Validation (such as password and confirm password matching) on a `FormGroup`?",
    quickAnswer: "Apply the validator to the `FormGroup` level (in the group's options `{ validators: [matchValidator] }`) rather than an individual control. Inside the validator function, retrieve child controls via `group.get('password')` and compare their values.",
    detailedAnswer: "When validation depends on two or more fields, placing the validator on an individual `FormControl` leads to out-of-sync states (e.g. editing the first field doesn't trigger re-validation of the second). Applying the validator to the parent `FormGroup` ensures that whenever either field changes, the group validator re-evaluates. You can attach errors to the group (`group.errors?.['mismatch']`) or explicitly set errors on the child control.",
    code: `import { AbstractControl, ValidationErrors, ValidatorFn, FormGroup, FormControl } from '@angular/forms';

// Cross-field validator applied to the parent FormGroup:
export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword) {
    return null;
  }

  return password.value === confirmPassword.value ? null : { passwordMismatch: true };
};

// Usage:
export const registrationForm = new FormGroup({
  password: new FormControl('', { nonNullable: true }),
  confirmPassword: new FormControl('', { nonNullable: true })
}, { validators: [passwordMatchValidator] }); // <-- Attached to Group`,
    recallHint: "Attach cross-field validators to FormGroup options: { validators: [matchValidator] }.",
    interviewTip: "Mention that if the user fixes `password` after entering `confirmPassword`, group-level validators trigger automatically, whereas control-level validators wouldn't without manual `updateValueAndValidity()`.",
    tags: ["cross-field", "validation", "formgroup", "forms"],
    practice: [
      "How do you display error messages in the template when an error is on the `FormGroup` instead of a `FormControl`?",
      "When is calling `control.updateValueAndValidity()` necessary?"
    ]
  }),

  createCard({
    idNum: 90,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Dynamic Form Arrays (FormArray)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you manage dynamic collections of form controls or groups using typed `FormArray`?",
    quickAnswer: "`FormArray` manages an ordered, dynamically sized list of `FormControl`, `FormGroup`, or other `FormArray` instances. Use `push()`, `removeAt(index)`, `insert()`, and `clear()`. Iterate over `formArray.controls` in templates using `@for`.",
    detailedAnswer: "In enterprise applications (like invoice line items or user phone numbers), the number of fields varies at runtime. `FormArray<T>` provides dynamic CRUD operations for controls while maintaining typed state. In templates, bind `formArrayName` to the array and iterate over `controls` using index binding `[formGroupName]=\"idx\"`.",
    code: `import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, FormArray, FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';

interface LineItem {
  description: FormControl<string>;
  amount: FormControl<number>;
}

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="invoiceForm">
      <div formArrayName="items">
        @for (item of items.controls; track $index; let idx = $index) {
          <div [formGroupName]="idx" class="item-row">
            <input formControlName="description" placeholder="Item name" />
            <input formControlName="amount" type="number" />
            <button type="button" (click)="removeItem(idx)">Remove</button>
          </div>
        }
      </div>
      <button type="button" (click)="addItem()">Add Item</button>
    </form>
  \`
})
export class InvoiceFormComponent {
  private fb = inject(NonNullableFormBuilder);

  invoiceForm = this.fb.group({
    items: this.fb.array<FormGroup<LineItem>>([])
  });

  get items(): FormArray<FormGroup<LineItem>> {
    return this.invoiceForm.controls.items;
  }

  addItem() {
    this.items.push(
      this.fb.group<LineItem>({
        description: this.fb.control(''),
        amount: this.fb.control(0)
      })
    );
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }
}`,
    recallHint: "FormArray: push(control), removeAt(index), clear(). Bind in template via formArrayName and [formGroupName]=\"$index\".",
    interviewTip: "Always create a typed getter (e.g. `get items()`) on the component class so the template can iterate over `items.controls` cleanly with type safety.",
    tags: ["formarray", "dynamic-forms", "typed-forms", "reactive-forms"],
    practice: [
      "Why does omitting the getter for `FormArray` cause TypeScript template type errors?",
      "How do you enforce minimum and maximum length validation on a `FormArray`?"
    ]
  }),

  createCard({
    idNum: 91,
    category: "Typed Forms & ControlValueAccessor",
    concept: "ControlValueAccessor (CVA) Core Interface",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is `ControlValueAccessor`, and what are its four contract methods?",
    quickAnswer: "`ControlValueAccessor` is the interface bridge between Angular Reactive/Template Forms and native or custom DOM elements. Its 4 methods are: 1) `writeValue(val)` (model to DOM), 2) `registerOnChange(fn)` (DOM to model notification), 3) `registerOnTouched(fn)` (blur/interaction notification), and 4) `setDisabledState(isDisabled)` (optional disabled state).",
    detailedAnswer: "When you attach `formControlName=\"rating\"` to a custom `<app-star-rating>`, Angular does not know how to read or write values to your component. Implementing `ControlValueAccessor` gives Angular that translation bridge: 1) `writeValue`: Angular pushes data into your component. 2) `registerOnChange`: Angular provides a callback function `onChange`; your component calls `this.onChange(val)` whenever the user interacts. 3) `registerOnTouched`: called when user blurs/touches the component. 4) `setDisabledState`: toggles UI disabled state.",
    code: `import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true
    }
  ],
  template: \`
    <div class="stars">
      @for (star of [1,2,3,4,5]; track star) {
        <span (click)="selectRating(star)" [class.active]="star <= rating">★</span>
      }
    </div>
  \`
})
export class StarRatingComponent implements ControlValueAccessor {
  rating = 0;
  disabled = false;
  private onChange: (val: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: number): void {
    this.rating = val || 0;
  }

  registerOnChange(fn: (val: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  selectRating(val: number) {
    if (!this.disabled) {
      this.rating = val;
      this.onChange(val); // Notify Angular form!
      this.onTouched();   // Mark control touched!
    }
  }
}`,
    recallHint: "CVA: writeValue (Model->UI), registerOnChange (UI->Model), registerOnTouched (blur), setDisabledState.",
    interviewTip: "Memorize the 4 methods and their direction of data flow. This is one of the most frequent senior Angular interview questions.",
    tags: ["controlvalueaccessor", "cva", "custom-components", "forms"],
    practice: [
      "Why must `forwardRef` be used when providing `NG_VALUE_ACCESSOR`?",
      "What bugs occur if a custom component fails to call `onTouched()`?"
    ]
  }),

  createCard({
    idNum: 92,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Providing NG_VALUE_ACCESSOR & forwardRef",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is `forwardRef` required when providing `NG_VALUE_ACCESSOR` in a component's `providers` array?",
    quickAnswer: "In JavaScript, class declarations are not hoisted. When the `@Component({...})` decorator executes at runtime, the component class has not yet been defined. `forwardRef(() => MyComponent)` wraps the reference in a closure, deferring its resolution until Angular's DI container is initialized.",
    detailedAnswer: "When TypeScript compiles decorators, `@Component` runs as an immediately invoked function expression wrapping the class. If you write `useExisting: MyComponent`, `MyComponent` evaluates to `undefined` because the class is declared immediately below the decorator. `forwardRef` creates a lazy token getter function that Angular resolves after the class has been declared in memory.",
    code: `import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-custom-toggle',
  standalone: true,
  providers: [
    {
      // NG_VALUE_ACCESSOR tells Angular Form directives this component implements CVA
      provide: NG_VALUE_ACCESSOR,
      // forwardRef solves circular reference of class not defined yet
      useExisting: forwardRef(() => CustomToggleComponent),
      // multi: true allows multiple providers under the same injection token
      multi: true
    }
  ],
  template: \`<button (click)="toggle()">Toggle</button>\`
})
export class CustomToggleComponent implements ControlValueAccessor {
  // CVA implementation...
  writeValue(obj: any): void {}
  registerOnChange(fn: any): void {}
  registerOnTouched(fn: any): void {}
  toggle() {}
}`,
    recallHint: "forwardRef(() => Class): defers token lookup until class is evaluated, bypassing JS hoisting limitations.",
    interviewTip: "Note that in Angular 17+, you can also implement CVA using host directives or signal-based wrappers, but `forwardRef` remains foundational.",
    tags: ["forwardref", "ng-value-accessor", "di", "internals"],
    practice: [
      "What is `multi: true` in Angular DI providers?",
      "How does `forwardRef` work internally using a closure function?"
    ]
  }),

  createCard({
    idNum: 93,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Template-Driven Forms vs Reactive Forms",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the core differences between Template-Driven Forms (`ngModel`) and Reactive Forms (`FormGroup`)?",
    quickAnswer: "Template-Driven forms are declarative, asynchronous, and managed entirely in HTML using directives (`FormsModule`, `[(ngModel)]`, `ngForm`). Reactive forms are imperative, synchronous, strongly typed, defined in TypeScript, and provide superior testability and scalability for enterprise applications.",
    detailedAnswer: "Template-driven forms rely on Angular creating form objects implicitly behind the scenes, which makes programmatic access asynchronous and unit testing difficult. Reactive forms give the developer explicit control over the `FormGroup` tree in TypeScript. State changes are synchronous, validation logic is decoupled from templates, and complex dynamic requirements (like dynamic FormArrays and conditional validation) are trivial to implement in reactive forms.",
    code: `// TEMPLATE-DRIVEN (HTML-centric):
// <form #userForm="ngForm" (ngSubmit)="save(userForm.value)">
//   <input name="email" [(ngModel)]="user.email" required email #email="ngModel" />
// </form>

// REACTIVE (TypeScript-centric, Preferred for Enterprise):
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-reactive-choice',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="save()">
      <input formControlName="email" />
    </form>
  \`
})
export class ReactiveChoiceComponent {
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  save() {
    console.log(this.form.value);
  }
}`,
    recallHint: "Template-Driven: async, in HTML, ngModel. Reactive: sync, in TS, strictly typed, enterprise standard.",
    interviewTip: "State clearly that for enterprise applications with complex validation, dynamic fields, or unit testing requirements, Reactive Forms are the industry standard.",
    tags: ["reactive-forms", "template-driven", "comparison", "forms"],
    practice: [
      "Can Reactive Forms and Template-Driven forms be used in the same Angular application?",
      "Why is unit testing a Reactive Form easier than testing a Template-Driven form?"
    ]
  }),

  createCard({
    idNum: 94,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Form Status & State Flags (dirty, touched, valid, pending)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What do the form control state flags (`dirty`, `pristine`, `touched`, `untouched`, `valid`, `invalid`, `pending`) represent?",
    quickAnswer: "1) `dirty`: user changed the value (opposite of `pristine`). 2) `touched`: control lost focus (`blur`) (opposite of `untouched`). 3) `valid`: passed all validators (opposite of `invalid`). 4) `pending`: currently executing an asynchronous validator.",
    detailedAnswer: "These state flags allow fine-tuned UI error message display. Showing errors immediately when a form loads creates terrible UX. The standard best practice is displaying error messages only when a control is invalid AND touched (`control.invalid && control.touched`), meaning the user has interacted with the field and blurred away without providing valid input.",
    code: `import { Component } from '@angular/core';
import { FormControl, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-state-demo',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <input [formControl]="email" (blur)="email.markAsTouched()" />

    <!-- Show error only when user has touched the field and it is invalid -->
    @if (email.invalid && (email.dirty || email.touched)) {
      <div class="error-msg">
        @if (email.errors?.['required']) { <span>Email is required.</span> }
        @if (email.errors?.['email']) { <span>Invalid email format.</span> }
      </div>
    }

    <!-- Show spinner during async validation -->
    @if (email.pending) {
      <span class="spinner">Validating with server...</span>
    }
  \`
})
export class StateDemoComponent {
  email = new FormControl('', [Validators.required, Validators.email]);
}`,
    recallHint: "dirty: value changed; touched: blur triggered; pending: async validation running. Show error if invalid && touched.",
    interviewTip: "Mention that Angular automatically applies CSS classes (`ng-dirty`, `ng-touched`, `ng-invalid`, `ng-pending`) to the DOM element matching these states.",
    tags: ["form-state", "validation", "touched", "dirty"],
    practice: [
      "How do Angular's built-in CSS classes (`.ng-invalid.ng-touched`) allow pure CSS form error styling?",
      "What is the difference between `dirty` and `touched`?"
    ]
  }),

  createCard({
    idNum: 95,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Resetting Forms & Clearing Validation State",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you properly reset an Angular form after submission without triggering false validation error states?",
    quickAnswer: "Call `form.reset()`. It resets the controls' values, marks the entire form as `pristine` and `untouched`, and clears errors. If using non-nullable controls, it resets them to their initial defaults. Do not simply assign values with `setValue({})` as that leaves the form marked as dirty.",
    detailedAnswer: "A common bug occurs when developers reset values using `form.patchValue({ email: '' })` after submission. Because the controls remain touched or dirty, validation errors immediately flash red on the screen. Calling `this.form.reset()` resets both values and resets `pristine: true` and `untouched: true`, leaving the form in a clean initial state.",
    code: `import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="name" />
      <button type="submit">Submit</button>
    </form>
  \`
})
export class ContactFormComponent {
  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  });

  submit() {
    if (this.form.valid) {
      console.log('Sending payload:', this.form.getRawValue());

      // PROPER RESET:
      // Resets value to default ('') AND sets pristine = true, touched = false
      this.form.reset();
    } else {
      // If invalid, mark all as touched so errors display:
      this.form.markAllAsTouched();
    }
  }
}`,
    recallHint: "form.reset() resets values AND marks pristine/untouched. form.markAllAsTouched() highlights errors on submit.",
    interviewTip: "Highlight `form.markAllAsTouched()`—it is the modern, built-in way to highlight all validation errors when a user clicks submit without filling mandatory fields.",
    tags: ["forms", "reset", "markallasTouched", "best-practices"],
    practice: [
      "How does `form.markAllAsTouched()` traverse nested `FormGroup` and `FormArray` hierarchies?",
      "What is the difference between `reset()` and `patchValue()`?"
    ]
  }),

  createCard({
    idNum: 96,
    category: "Typed Forms & ControlValueAccessor",
    concept: "Bridging Reactive Forms with Angular Signals",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you bridge Angular Reactive Forms with Angular Signals using `toSignal()`?",
    quickAnswer: "Use `toSignal(form.valueChanges)` or `toSignal(control.statusChanges)` to convert form Observable streams into reactive Signals, allowing computed signals and template expressions to react synchronously to form changes.",
    detailedAnswer: "While Angular plans deeper native Signal-based forms in future releases, modern Angular integrates Reactive Forms with Signals via `@angular/core/rxjs-interop`. Converting `form.valueChanges` to a Signal enables deriving computed state (e.g. `isSubmitEnabled = computed(() => formValid() && isAgreed())`) without managing RxJS subscriptions.",
    code: `import { Component, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-signal-form-bridge',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <input [formControl]="searchQuery" placeholder="Search..." />
    <p>Length: {{ queryLength() }}</p>
    <p>Is Valid: {{ isValid() }}</p>
  \`
})
export class SignalFormBridgeComponent {
  searchQuery = new FormControl('', { nonNullable: true });

  // 1. Convert form value stream into a Signal:
  querySignal = toSignal(this.searchQuery.valueChanges, { initialValue: this.searchQuery.value });

  // 2. Derive computed state effortlessly:
  queryLength = computed(() => this.querySignal().length);
  isValid = computed(() => this.queryLength() >= 3);
}`,
    recallHint: "toSignal(form.valueChanges, { initialValue }) turns form streams into synchronous Signals.",
    interviewTip: "Always provide `{ initialValue: control.value }` when converting `valueChanges` with `toSignal` to avoid an initial `undefined` value.",
    tags: ["forms", "signals", "tosignal", "rxjs-interop"],
    practice: [
      "Why does `toSignal(form.valueChanges)` emit undefined on initialization if `initialValue` is omitted?",
      "Can a Signal directly update a `FormControl` using an `effect()`?"
    ]
  })
];
