module.exports = [
  {
    id: "angular-ex-33",
    title: "Functional Auth Guard with Return URL Redirection",
    category: "Routing & Form Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Guards protected routes using CanActivateFn, atomically redirecting unauthenticated users to /login and preserving returnUrl query parameter.",
    conceptsCovered: [
      "CanActivateFn",
      "UrlTree",
      "Router.createUrlTree",
      "Functional Guards",
      "Return URL"
    ],
    code: `import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Mock AuthService contract
export interface AuthService { isAuthenticated(): boolean; }
export const AUTH_SERVICE = 'AUTH_SERVICE';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  // In real app: const auth = inject(AuthService);
  const isAuthenticated = false; // Mocked unauthenticated state

  if (isAuthenticated) {
    return true;
  }

  // ATOMIC REDIRECT: Returns a UrlTree preserving the attempted destination
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

// Route Configuration:
// { path: 'dashboard', canActivate: [authGuard], loadComponent: ... }`,
    breakdown: [
      "CanActivateFn eliminates class-based guard boilerplate and implements functional injection.",
      "state.url contains the full path the user was attempting to visit.",
      "Returning router.createUrlTree cancels the pending navigation and triggers redirect in one turn.",
      "Attaches returnUrl query param so login page can redirect back after successful login."
    ],
    expectedOutput: "Unauthenticated navigation redirected to /login?returnUrl=%2Fdashboard atomically."
  },
  {
    id: "angular-ex-34",
    title: "Unsaved Changes Guard with CanDeactivateFn & Modal Confirmation",
    category: "Routing & Form Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Warns users when navigating away from dirty forms using CanDeactivateFn and an asynchronous confirmation dialog.",
    conceptsCovered: [
      "CanDeactivateFn",
      "Form Dirty State",
      "Dialog Confirmation",
      "Navigation Abort",
      "Interface Contract"
    ],
    code: `import { CanDeactivateFn } from '@angular/router';

// Contract interface for components that feature unsaved changes
export interface FormDeactivatable {
  hasUnsavedChanges(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<FormDeactivatable> = (component) => {
  // If no unsaved changes exist, allow navigation immediately
  if (!component.hasUnsavedChanges()) {
    return true;
  }

  // Prompt user; in production use a custom Angular Material or Signals modal dialog:
  const confirmation = window.confirm(
    'You have unsaved form modifications. Are you sure you want to discard them?'
  );

  return confirmation; // true allows navigation; false aborts navigation
};`,
    breakdown: [
      "CanDeactivateFn receives the active component instance with full TypeScript typing.",
      "Component implements hasUnsavedChanges() returning true if form is dirty.",
      "Returning false cancels navigation and keeps the user on the existing view.",
      "Supports returning boolean, Promise<boolean>, or Observable<boolean> for async modals."
    ],
    expectedOutput: "Attempting to navigate away from an edited form prompts confirmation dialog."
  },
  {
    id: "angular-ex-35",
    title: "Dynamic Feature Flag Branching Route with CanMatchFn",
    category: "Routing & Form Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Routes users to completely different components for the exact same URL path based on feature flags using CanMatchFn.",
    conceptsCovered: [
      "CanMatchFn",
      "Feature Flagging",
      "Route Fallthrough",
      "A/B Testing",
      "Dynamic Loading"
    ],
    code: `import { inject } from '@angular/core';
import { CanMatchFn, Routes } from '@angular/router';

// Mock Feature Flag Service
class FeatureFlagService {
  isFeatureActive(flag: string): boolean {
    return flag === 'new_checkout'; // Toggle feature
  }
}

export const newCheckoutGuard: CanMatchFn = () => {
  const flags = new FeatureFlagService();
  return flags.isFeatureActive('new_checkout');
};

export const routes: Routes = [
  // 1. Matched if beta flag is active:
  {
    path: 'checkout',
    canMatch: [newCheckoutGuard],
    loadComponent: () => import('./v2-checkout.component').then(m => m.V2CheckoutComponent)
  },
  // 2. Fallback: Matched if guard returns false:
  {
    path: 'checkout',
    loadComponent: () => import('./legacy-checkout.component').then(m => m.LegacyCheckoutComponent)
  }
];`,
    breakdown: [
      "CanMatchFn determines whether a route definition can match during the initial URL evaluation.",
      "If newCheckoutGuard returns false, the router does NOT abort; it falls through to candidate #2.",
      "Enables clean A/B rollout without having ugly conditional logic inside a single monolithic component.",
      "Prevents downloading the v2 chunk for users who are not in the beta test group."
    ],
    expectedOutput: "URL /checkout renders V2Checkout for beta users and LegacyCheckout for regular users."
  },
  {
    id: "angular-ex-36",
    title: "Network-Aware Selective Preloading Strategy",
    category: "Routing & Form Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Preloads lazy route bundles conditionally based on route data.preload flags and checks if the client is on a 2G/data-saver mobile connection.",
    conceptsCovered: [
      "PreloadingStrategy",
      "Route.data",
      "Network Information API",
      "Data-Saver Optimization",
      "Performance"
    ],
    code: `import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SelectivePreloadingStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<any>): Observable<any> {
    // 1. Check if user has requested Data-Saver in browser:
    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      const conn = (navigator as any).connection;
      if (conn.saveData || /2g/.test(conn.effectiveType)) {
        console.log('Skipping preload on slow or metered mobile connection');
        return of(null);
      }
    }

    // 2. Check if route definition explicitly flagged data: { preload: true }
    if (route.data && route.data['preload']) {
      return load();
    }

    return of(null);
  }
}

// In app.config.ts:
// provideRouter(routes, withPreloading(SelectivePreloadingStrategy))`,
    breakdown: [
      "Implements Angular's PreloadingStrategy contract.",
      "Inspects navigator.connection.saveData to respect mobile user bandwidth limits.",
      "Preloads only routes explicitly tagged with data: { preload: true }.",
      "Combines fast initial application loads with instant subsequent page transitions."
    ],
    expectedOutput: "High-priority routes preload in background on Wi-Fi, but skip on 2G/metered data."
  },
  {
    id: "angular-ex-37",
    title: "Dynamic FormArray with Real-Time Total Calculation",
    category: "Routing & Form Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a dynamic invoice line-item form using typed FormArray and calculates the grand total in real-time using RxJS and toSignal.",
    conceptsCovered: [
      "FormArray",
      "NonNullableFormBuilder",
      "toSignal",
      "Dynamic Rows",
      "Typed Forms"
    ],
    code: `import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, FormArray, FormGroup, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

interface LineItemForm {
  description: FormControl<string>;
  price: FormControl<number>;
  quantity: FormControl<number>;
}

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form">
      <div formArrayName="items">
        @for (item of items.controls; track $index; let idx = $index) {
          <div [formGroupName]="idx" class="item-row">
            <input formControlName="description" placeholder="Item description" />
            <input formControlName="price" type="number" />
            <input formControlName="quantity" type="number" />
            <button type="button" (click)="removeItem(idx)">Delete</button>
          </div>
        }
      </div>
      <button type="button" (click)="addItem()">Add Line Item</button>
      <p>Grand Total: \${{ grandTotal() }}</p>
    </form>
  \`
})
export class InvoiceFormComponent {
  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
    items: this.fb.array<FormGroup<LineItemForm>>([])
  });

  get items(): FormArray<FormGroup<LineItemForm>> {
    return this.form.controls.items;
  }

  // Real-time grand total stream converted into Signal:
  grandTotal = toSignal(
    this.form.valueChanges.pipe(
      map(val => (val.items || []).reduce((acc, row) => acc + ((row?.price || 0) * (row?.quantity || 0)), 0))
    ),
    { initialValue: 0 }
  );

  addItem() {
    this.items.push(
      this.fb.group<LineItemForm>({
        description: this.fb.control('', [Validators.required]),
        price: this.fb.control(0, [Validators.min(0)]),
        quantity: this.fb.control(1, [Validators.min(1)])
      })
    );
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }
}`,
    breakdown: [
      "Typed FormArray manages dynamic list of FormGroup<LineItemForm> entries.",
      "items.push() and items.removeAt(index) handle dynamic row creation and deletion.",
      "valueChanges stream observes all line item updates and recalculates total.",
      "toSignal provides clean synchronous grandTotal() signal for template rendering."
    ],
    expectedOutput: "Invoice rows add/remove dynamically with real-time recalculation of grand total."
  },
  {
    id: "angular-ex-38",
    title: "Custom Star Rating Widget implementing ControlValueAccessor",
    category: "Routing & Form Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a production-ready 5-star rating form widget implementing ControlValueAccessor, integrating with standard reactive forms and validation.",
    conceptsCovered: [
      "ControlValueAccessor",
      "NG_VALUE_ACCESSOR",
      "forwardRef",
      "writeValue",
      "registerOnChange"
    ],
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
  styles: [\`
    .star { font-size: 24px; cursor: pointer; color: #ccc; }
    .star.filled { color: #f5a623; }
    :host(.disabled) .star { cursor: not-allowed; opacity: 0.6; }
  \`],
  template: \`
    <div class="rating-container" [class.disabled]="isDisabled">
      @for (star of [1,2,3,4,5]; track star) {
        <span 
          class="star" 
          [class.filled]="star <= value"
          (click)="setRating(star)"
        >★</span>
      }
    </div>
  \`
})
export class StarRatingComponent implements ControlValueAccessor {
  value = 0;
  isDisabled = false;

  private onChange: (v: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: number): void {
    this.value = val || 0;
  }

  registerOnChange(fn: (v: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  setRating(rating: number) {
    if (!this.isDisabled) {
      this.value = rating;
      this.onChange(rating);
      this.onTouched();
    }
  }
}

// Usage:
// <app-star-rating formControlName="userRating" />`,
    breakdown: [
      "NG_VALUE_ACCESSOR token registers component as an official form control accessor.",
      "forwardRef resolves class reference before TypeScript decorator execution finishes.",
      "writeValue receives external model value updates from parent form.",
      "onChange and onTouched notify parent form of user selection and blur state."
    ],
    expectedOutput: "Star rating widget binds directly with [formControl] or formControlName."
  },
  {
    id: "angular-ex-39",
    title: "Custom Asynchronous Username Uniqueness Validator",
    category: "Routing & Form Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an AsyncValidatorFn that checks username availability via HTTP, debouncing requests and returning error objects.",
    conceptsCovered: [
      "AsyncValidatorFn",
      "timer",
      "switchMap",
      "take(1)",
      "ValidationErrors"
    ],
    code: `import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, of } from 'rxjs';
import { switchMap, map, catchError, take } from 'rxjs/operators';

export function usernameAvailabilityValidator(http: HttpClient): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!control.value || control.value.trim().length < 3) {
      return of(null);
    }

    // Debounce HTTP call by 400ms:
    return timer(400).pipe(
      switchMap(() => http.get<{ exists: boolean }>(\`/api/users/check?name=\${encodeURIComponent(control.value)}\`)),
      map(res => (res.exists ? { usernameTaken: { requested: control.value } } : null)),
      catchError(() => of(null)), // Don't block form if server is offline
      take(1) // Mandatory: Observable MUST complete!
    );
  };
}

// In Component:
// const usernameCtrl = new FormControl('', {
//   asyncValidators: [usernameAvailabilityValidator(this.http)],
//   updateOn: 'change'
// });`,
    breakdown: [
      "AsyncValidatorFn returns an Observable emitting ValidationErrors | null.",
      "timer(400) debounces user typing, avoiding network flooding on every keystroke.",
      "switchMap cancels pending checks if the user continues typing.",
      "take(1) guarantees stream completion; incomplete streams leave control stuck in PENDING status."
    ],
    expectedOutput: "Input checks availability 400ms after user pauses; flags error if name is taken."
  },
  {
    id: "angular-ex-40",
    title: "Cross-Field Password & Confirmation Validator",
    category: "Routing & Form Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces password matching across two form fields using a cross-field validator attached to the parent FormGroup.",
    conceptsCovered: [
      "ValidatorFn",
      "Cross-field Validation",
      "FormGroup Validators",
      "updateValueAndValidity",
      "Error Keys"
    ],
    code: `import { AbstractControl, ValidationErrors, ValidatorFn, FormGroup, FormControl, Validators } from '@angular/forms';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (!password || !confirmPassword) return null;

  // Don't validate if confirm password is empty yet
  if (!confirmPassword.value) return null;

  return password.value === confirmPassword.value
    ? null
    : { passwordMismatch: true };
};

// Form Definition:
export function createRegistrationForm() {
  return new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
  }, { validators: [passwordMatchValidator] }); // Attached to parent group!
}

// In Template:
// @if (form.errors?.['passwordMismatch'] && form.get('confirmPassword')?.touched) {
//   <p class="error">Passwords do not match.</p>
// }`,
    breakdown: [
      "Cross-field validators are attached to the FormGroup options object, not individual controls.",
      "Reads child controls via control.get('password') and compares values safely.",
      "Recalculates automatically whenever either password or confirmPassword changes.",
      "Displays error cleanly in template when parent form exhibits passwordMismatch error."
    ],
    expectedOutput: "Form indicates invalid status when password and confirmPassword fields differ."
  },
  {
    id: "angular-ex-41",
    title: "Auto-Saving Form with toSignal & Debounced Storage",
    category: "Routing & Form Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Watches reactive form value changes, debounces modifications by 1 second, and saves draft state automatically with visual saving indicators.",
    conceptsCovered: [
      "valueChanges",
      "debounceTime",
      "switchMap",
      "toSignal",
      "Auto-save"
    ],
    code: `import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-auto-save-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <form [formGroup]="form">
      <input formControlName="title" placeholder="Document title" />
      <textarea formControlName="notes" placeholder="Notes..."></textarea>
    </form>
    <div class="save-indicator">Status: {{ saveStatus() }}</div>
  \`
})
export class AutoSaveFormComponent {
  private fb = inject(NonNullableFormBuilder);
  private http = inject(HttpClient);

  form = this.fb.group({
    title: this.fb.control(''),
    notes: this.fb.control('')
  });

  // Observe form modifications and auto-save after 1000ms idle:
  private save$ = this.form.valueChanges.pipe(
    debounceTime(1000),
    switchMap(payload => {
      console.log('Auto-saving draft:', payload);
      // Mock API save:
      return of('Saved just now').pipe(tap());
    })
  );

  saveStatus = toSignal(this.save$, { initialValue: 'All changes saved' });
}`,
    breakdown: [
      "form.valueChanges emits whenever any control value in the form changes.",
      "debounceTime(1000) delays save until user stops typing for 1 full second.",
      "switchMap cancels prior pending saves if new input arrives, ensuring only latest draft saves.",
      "saveStatus signal renders saving confirmation feedback cleanly to user."
    ],
    expectedOutput: "Form automatically persists draft 1s after user stops typing."
  },
  {
    id: "angular-ex-42",
    title: "Tag / Chip Input Component with Custom CVA & Keyboard Navigation",
    category: "Routing & Form Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Creates an interactive tag/chip input widget implementing ControlValueAccessor with Enter key insertion and Backspace tag deletion.",
    conceptsCovered: [
      "ControlValueAccessor",
      "NG_VALUE_ACCESSOR",
      "Keyboard Navigation",
      "Tag System",
      "Immutability"
    ],
    code: `import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-chip-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChipInputComponent),
      multi: true
    }
  ],
  styles: [\`
    .chip-container { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border: 1px solid #ccc; }
    .chip { background: #e0e0e0; padding: 2px 8px; border-radius: 12px; font-size: 13px; }
    .chip button { border: none; background: transparent; cursor: pointer; margin-left: 4px; }
    input { border: none; outline: none; flex: 1; min-width: 100px; }
  \`],
  template: \`
    <div class="chip-container">
      @for (chip of chips; track chip; let idx = $index) {
        <span class="chip">
          {{ chip }}
          <button type="button" (click)="removeChip(idx)">×</button>
        </span>
      }
      <input 
        #chipInput
        placeholder="Add tag and press Enter"
        (keydown.enter)="addChip($event, chipInput)"
        (keydown.backspace)="onBackspace(chipInput)"
      />
    </div>
  \`
})
export class ChipInputComponent implements ControlValueAccessor {
  chips: string[] = [];
  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string[]): void {
    this.chips = val || [];
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  addChip(e: Event, input: HTMLInputElement) {
    e.preventDefault();
    const val = input.value.trim();
    if (val && !this.chips.includes(val)) {
      this.chips = [...this.chips, val];
      input.value = '';
      this.onChange(this.chips);
      this.onTouched();
    }
  }

  removeChip(index: number) {
    this.chips = this.chips.filter((_, i) => i !== index);
    this.onChange(this.chips);
    this.onTouched();
  }

  onBackspace(input: HTMLInputElement) {
    if (!input.value && this.chips.length > 0) {
      this.removeChip(this.chips.length - 1);
    }
  }
}`,
    breakdown: [
      "Implements ControlValueAccessor for string[] tag collections.",
      "Enter key listener adds new unique tag and clears input field.",
      "Backspace on empty input deletes the most recently added tag.",
      "Notifies parent form via this.onChange(this.chips) with immutable array reference."
    ],
    expectedOutput: "Tag input widget creates and deletes tags via keyboard and binds with formControl."
  }
];
