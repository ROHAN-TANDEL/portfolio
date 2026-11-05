module.exports = [
  {
    id: "react-ex-23",
    title: "Undo / Redo History State Machine with useReducer",
    category: "Complex State & Reducers",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements full time-travel undo and redo history tracking around an arbitrary state value using a pure reducer maintaining past, present, and future stacks.",
    conceptsCovered: [
      "Time-Travel State",
      "Past / Present / Future Stacks",
      "Pure Reducer Invariants",
      "useReducer History Management"
    ],
    code: `import { useReducer, useCallback } from 'react';

// History reducer managing past, present, and future stacks
function historyReducer(state, action) {
  const { past, present, future } = state;

  switch (action.type) {
    case 'UNDO': {
      if (past.length === 0) return state;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [present, ...future]
      };
    }
    case 'REDO': {
      if (future.length === 0) return state;
      const next = future[0];
      const newFuture = future.slice(1);
      return {
        past: [...past, present],
        present: next,
        future: newFuture
      };
    }
    case 'SET': {
      const { newPresent } = action;
      if (newPresent === present) return state;
      return {
        past: [...past, present],
        present: newPresent,
        future: [] // Clear redo history on new action
      };
    }
    case 'RESET': {
      return { past: [], present: action.initialPresent, future: [] };
    }
    default:
      return state;
  }
}

// Custom hook wrapping the history reducer:
export function useHistoryState(initialPresent) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialPresent,
    future: []
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const set = useCallback((newPresent) => dispatch({ type: 'SET', newPresent }), []);

  return { state: state.present, set, undo, redo, canUndo, canRedo };
}`,
    breakdown: [
      "past array holds previous snapshots; future array holds undone snapshots for redo.",
      "Dispatching 'SET' clears future stack, establishing a new timeline branch.",
      "canUndo and canRedo booleans easily control button disabled states.",
      "Provides reliable undo/redo for canvas editors, text areas, or complex configuration builders."
    ],
    expectedOutput: `Users can modify text, click Undo to revert to previous states, and click Redo to restore.`
  },
  {
    id: "react-ex-24",
    title: "Normalized Entity Store with Normalized Insert, Update & Delete Actions",
    category: "Complex State & Reducers",
    difficulty: "advanced",
    whatThisCodeCovers: "Maintains a relational, normalized entity store (byId and allIds) inside useReducer, achieving O(1) lookups and updates without deep nested object cloning.",
    conceptsCovered: [
      "Relational State Normalization",
      "byId Dictionary & allIds Array",
      "O(1) Entity Operations",
      "useReducer Entity Management"
    ],
    code: `import { useReducer } from 'react';

const initialStore = {
  byId: {},
  allIds: []
};

function entityReducer(state, action) {
  switch (action.type) {
    case 'ADD_ENTITY': {
      const { entity } = action;
      if (state.byId[entity.id]) return state; // Avoid duplicate IDs
      return {
        byId: { ...state.byId, [entity.id]: entity },
        allIds: [...state.allIds, entity.id]
      };
    }
    case 'UPDATE_ENTITY': {
      const { id, updates } = action;
      if (!state.byId[id]) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [id]: { ...state.byId[id], ...updates }
        }
      };
    }
    case 'DELETE_ENTITY': {
      const { id } = action;
      const { [id]: deleted, ...remainingById } = state.byId;
      return {
        byId: remainingById,
        allIds: state.allIds.filter(entityId => entityId !== id)
      };
    }
    default:
      return state;
  }
}

export function EntityManager() {
  const [store, dispatch] = useReducer(entityReducer, initialStore);

  const addCustomer = (name) => {
    const id = \`cust-\${Date.now()}\`;
    dispatch({ type: 'ADD_ENTITY', entity: { id, name, tier: 'STANDARD' } });
  };

  const promoteCustomer = (id) => {
    dispatch({ type: 'UPDATE_ENTITY', id, updates: { tier: 'VIP' } });
  };

  return (
    <div>
      <button onClick={() => addCustomer('Alice')}>Add Alice</button>
      <ul>
        {store.allIds.map(id => {
          const entity = store.byId[id];
          return (
            <li key={id}>
              {entity.name} ({entity.tier})
              <button onClick={() => promoteCustomer(id)}>Promote</button>
              <button onClick={() => dispatch({ type: 'DELETE_ENTITY', id })}>Delete</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}`,
    breakdown: [
      "byId dictionary stores entities keyed by their unique ID, enabling O(1) lookups and updates.",
      "allIds array maintains the explicit display order of entities.",
      "Deleting an entity uses object destructuring (const { [id]: deleted, ...remainingById } = state.byId).",
      "Eliminates slow array.map and array.find traversals across large datasets."
    ],
    expectedOutput: `Entities are inserted, updated, and deleted with clean O(1) dictionary operations.`
  },
  {
    id: "react-ex-25",
    title: "Async Multi-Step Wizard State Machine with Guaranteed Finite States",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "Models an asynchronous multi-step onboarding wizard as a Finite State Machine (FSM) inside useReducer to prevent impossible loading/error overlap states.",
    conceptsCovered: [
      "Finite State Machine (FSM)",
      "Discriminator Status Pattern",
      "Impossible State Prevention",
      "Deterministic Action Transitions"
    ],
    code: `import { useReducer } from 'react';

const initialState = {
  status: 'STEP_1_ACCOUNT',
  accountInfo: null,
  paymentInfo: null,
  error: null
};

function wizardReducer(state, action) {
  switch (state.status) {
    case 'STEP_1_ACCOUNT':
      if (action.type === 'SUBMIT_ACCOUNT') {
        return {
          ...state,
          status: 'STEP_2_PAYMENT',
          accountInfo: action.payload,
          error: null
        };
      }
      return state;

    case 'STEP_2_PAYMENT':
      if (action.type === 'BACK') {
        return { ...state, status: 'STEP_1_ACCOUNT', error: null };
      }
      if (action.type === 'START_PROCESSING') {
        return { ...state, status: 'PROCESSING', paymentInfo: action.payload, error: null };
      }
      return state;

    case 'PROCESSING':
      if (action.type === 'PAYMENT_SUCCESS') {
        return { ...state, status: 'SUCCESS' };
      }
      if (action.type === 'PAYMENT_FAILED') {
        return { ...state, status: 'STEP_2_PAYMENT', error: action.error };
      }
      return state;

    case 'SUCCESS':
      if (action.type === 'RESET') return initialState;
      return state;

    default:
      return state;
  }
}

export function OnboardingWizard() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  return (
    <div className="wizard-shell">
      {state.status === 'STEP_1_ACCOUNT' && (
        <div>
          <h2>Step 1: Account</h2>
          <button onClick={() => dispatch({ 
            type: 'SUBMIT_ACCOUNT', 
            payload: { email: 'dev@acme.com' } 
          })}>
            Next to Payment
          </button>
        </div>
      )}

      {state.status === 'STEP_2_PAYMENT' && (
        <div>
          <h2>Step 2: Payment</h2>
          {state.error && <p className="error">{state.error}</p>}
          <button onClick={() => dispatch({ type: 'BACK' })}>Back</button>
          <button onClick={() => {
            dispatch({ type: 'START_PROCESSING', payload: { card: '4242' } });
            setTimeout(() => dispatch({ type: 'PAYMENT_SUCCESS' }), 1500);
          }}>
            Pay Now
          </button>
        </div>
      )}

      {state.status === 'PROCESSING' && <p>Processing transaction securely...</p>}
      {state.status === 'SUCCESS' && <h2>🎉 Onboarding Complete!</h2>}
    </div>
  );
}`,
    breakdown: [
      "status string acts as the FSM discriminator, completely eliminating impossible combinations like isProcessing && isSuccess.",
      "Actions can only trigger valid transitions defined for the active state.",
      "If payment fails, state returns to STEP_2_PAYMENT with the specific error populated.",
      "Keeps complex multi-step async UI completely deterministic."
    ],
    expectedOutput: `Wizard steps progress strictly through valid states (STEP_1 -> STEP_2 -> PROCESSING -> SUCCESS).`
  },
  {
    id: "react-ex-26",
    title: "Shopping Cart Reducer with Discounts, Taxes & Quantity Caps",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "A comprehensive e-commerce shopping cart reducer managing item additions, removals, stock quantity limits, discount promo codes, and sales tax calculation.",
    conceptsCovered: [
      "Item Quantity Management",
      "Coupon Code Validation",
      "Derived Financial Math",
      "Pure Reducer Invariants"
    ],
    code: `import { useReducer } from 'react';

const initialCart = {
  items: [], // [{ id, title, price, quantity, maxStock }]
  discountCode: null,
  discountPct: 0
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(i => i.id === action.item.id);
      if (existing) {
        // Enforce inventory stock cap
        const newQty = Math.min(existing.quantity + 1, existing.maxStock);
        return {
          ...state,
          items: state.items.map(i => i.id === action.item.id ? { ...i, quantity: newQty } : i)
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.item, quantity: 1 }]
      };
    }
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.id !== action.id) };
      }
      return {
        ...state,
        items: state.items.map(i => i.id === action.id ? { ...i, quantity: Math.min(action.quantity, i.maxStock) } : i)
      };
    }
    case 'APPLY_DISCOUNT': {
      if (action.code === 'SAVE20') {
        return { ...state, discountCode: action.code, discountPct: 0.20 };
      }
      return state;
    }
    case 'CLEAR_CART':
      return initialCart;
    default:
      return state;
  }
}

export function CartManager() {
  const [cart, dispatch] = useReducer(cartReducer, initialCart);

  // Synchronously compute derived financial totals during render:
  const subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = subtotal * cart.discountPct;
  const tax = (subtotal - discountAmount) * 0.08; // 8% tax
  const grandTotal = subtotal - discountAmount + tax;

  return (
    <div className="cart-panel">
      <h3>Items in Cart ({cart.items.length})</h3>
      {cart.items.map(i => (
        <div key={i.id}>
          {i.title} - \${i.price} x {i.quantity}
          <button onClick={() => dispatch({ type: 'UPDATE_QUANTITY', id: i.id, quantity: i.quantity - 1 })}>-</button>
          <button onClick={() => dispatch({ type: 'UPDATE_QUANTITY', id: i.id, quantity: i.quantity + 1 })}>+</button>
        </div>
      ))}
      <div className="summary">
        <p>Subtotal: \${subtotal.toFixed(2)}</p>
        {cart.discountPct > 0 && <p>Discount (20%): -\${discountAmount.toFixed(2)}</p>}
        <p>Tax: \${tax.toFixed(2)}</p>
        <h4>Total: \${grandTotal.toFixed(2)}</h4>
        <button onClick={() => dispatch({ type: 'APPLY_DISCOUNT', code: 'SAVE20' })}>Apply SAVE20</button>
      </div>
    </div>
  );
}`,
    breakdown: [
      "Manages additions, quantity increments/decrements, and removals in an immutable array.",
      "Caps quantities to item.maxStock to prevent ordering out-of-stock inventory.",
      "Computes subtotal, discount, and tax during render rather than storing redundant derived numbers in state.",
      "Handles coupon validation cleanly via pure action dispatch."
    ],
    expectedOutput: `Cart recalculates subtotal, discounts, and tax accurately with quantity caps enforced.`
  },
  {
    id: "react-ex-27",
    title: "Context-Reducer Architecture with Context Splitting",
    category: "Complex State & Reducers",
    difficulty: "advanced",
    whatThisCodeCovers: "Combines useReducer with React Context splitting (StateContext and DispatchContext) to provide scalable global state with zero unnecessary consumer re-renders.",
    conceptsCovered: [
      "Context Splitting Pattern",
      "useReducer + Context Integration",
      "Stable Dispatch Provider",
      "Consumer Re-render Elimination"
    ],
    code: `import { createContext, useContext, useReducer } from 'react';

const TasksContext = createContext(null);
const TasksDispatchContext = createContext(null);

function tasksReducer(tasks, action) {
  switch (action.type) {
    case 'ADD':
      return [...tasks, { id: Date.now(), text: action.text, done: false }];
    case 'TOGGLE':
      return tasks.map(t => t.id === action.id ? { ...t, done: !t.done } : t);
    default:
      return tasks;
  }
}

export function TasksProvider({ children }) {
  const [tasks, dispatch] = useReducer(tasksReducer, []);

  return (
    <TasksContext.Provider value={tasks}>
      {/* Dispatch reference NEVER changes across renders! */}
      <TasksDispatchContext.Provider value={dispatch}>
        {children}
      </TasksDispatchContext.Provider>
    </TasksContext.Provider>
  );
}

// Custom consumption hooks:
export function useTasks() {
  return useContext(TasksContext);
}

export function useTasksDispatch() {
  return useContext(TasksDispatchContext);
}

// Button that ONLY dispatches actions: NEVER re-renders when tasks array changes!
export function AddTaskInput() {
  const dispatch = useTasksDispatch();
  return (
    <button onClick={() => dispatch({ type: 'ADD', text: 'New Task' })}>
      Add Task (Stable Component)
    </button>
  );
}`,
    breakdown: [
      "TasksContext holds the dynamic tasks array; TasksDispatchContext holds the stable dispatch function.",
      "Components that only dispatch actions (like AddTaskInput) consume TasksDispatchContext.",
      "When tasks update, components consuming only dispatch skip re-rendering entirely (0ms render overhead).",
      "The gold standard architecture for mid-sized React state management without third-party libraries."
    ],
    expectedOutput: `Dispatchers stay reference-stable; state consumers re-render only when data array mutates.`
  },
  {
    id: "react-ex-28",
    title: "Multi-Filter Data Table State with Sorting, Pagination & Reset",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "Coordinates complex tabular filtering, multi-column sort directions, page size, and pagination offset using a unified table state reducer.",
    conceptsCovered: [
      "Table State Reducer",
      "Multi-Column Sorting",
      "Pagination Offset Tracking",
      "Filter Reset Semantics"
    ],
    code: `import { useReducer } from 'react';

const initialTableState = {
  search: '',
  roleFilter: 'ALL',
  sortColumn: 'name',
  sortDirection: 'asc', // 'asc' | 'desc'
  page: 1,
  pageSize: 10
};

function tableReducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH':
      // Reset to page 1 whenever filters change!
      return { ...state, search: action.search, page: 1 };
    case 'SET_ROLE_FILTER':
      return { ...state, roleFilter: action.role, page: 1 };
    case 'TOGGLE_SORT':
      return {
        ...state,
        sortColumn: action.column,
        sortDirection: state.sortColumn === action.column && state.sortDirection === 'asc' ? 'desc' : 'asc'
      };
    case 'SET_PAGE':
      return { ...state, page: action.page };
    case 'RESET_ALL':
      return initialTableState;
    default:
      return state;
  }
}

export function UserDataTable() {
  const [tableState, dispatch] = useReducer(tableReducer, initialTableState);

  return (
    <div>
      <input 
        value={tableState.search} 
        onChange={e => dispatch({ type: 'SET_SEARCH', search: e.target.value })} 
        placeholder="Filter users..." 
      />
      <select 
        value={tableState.roleFilter} 
        onChange={e => dispatch({ type: 'SET_ROLE_FILTER', role: e.target.value })}
      >
        <option value="ALL">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="MEMBER">Member</option>
      </select>
      <button onClick={() => dispatch({ type: 'TOGGLE_SORT', column: 'name' })}>
        Sort Name ({tableState.sortColumn === 'name' ? tableState.sortDirection : 'none'})
      </button>
      <button onClick={() => dispatch({ type: 'RESET_ALL' })}>Reset Filters</button>
    </div>
  );
}`,
    breakdown: [
      "Centralizes 6 interconnected table query parameters into a single reducer.",
      "Changing search or filters automatically resets page back to 1, preventing empty page bugs.",
      "Toggling column sort swaps asc and desc or switches target column cleanly.",
      "RESET_ALL restores defaults in a single atomic action."
    ],
    expectedOutput: `Table parameters stay synchronized; updating search resets pagination to page 1.`
  },
  {
    id: "react-ex-29",
    title: "Complex Dynamic Nested Form Field Array Manager",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "Manages a dynamic list of nested form inputs (e.g. multiple phone numbers or team members) with add, remove, and field update capabilities.",
    conceptsCovered: [
      "Field Array Management",
      "Dynamic Row Generation",
      "Nested Immutability",
      "Array Key Stability"
    ],
    code: `import { useReducer } from 'react';

function formReducer(state, action) {
  switch (action.type) {
    case 'ADD_MEMBER':
      return {
        ...state,
        members: [...state.members, { id: Date.now(), name: '', role: 'Developer' }]
      };
    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.filter(m => m.id !== action.id)
      };
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(m => 
          m.id === action.id ? { ...m, [action.field]: action.value } : m
        )
      };
    default:
      return state;
  }
}

export function TeamEditor() {
  const [form, dispatch] = useReducer(formReducer, {
    members: [{ id: 1, name: 'Alice', role: 'Lead' }]
  });

  return (
    <div>
      <h3>Team Members</h3>
      {form.members.map(member => (
        <div key={member.id} className="member-row">
          <input
            value={member.name}
            onChange={e => dispatch({
              type: 'UPDATE_MEMBER',
              id: member.id,
              field: 'name',
              value: e.target.value
            })}
            placeholder="Member Name"
          />
          <button 
            disabled={form.members.length === 1} 
            onClick={() => dispatch({ type: 'REMOVE_MEMBER', id: member.id })}
          >
            Remove
          </button>
        </div>
      ))}
      <button onClick={() => dispatch({ type: 'ADD_MEMBER' })}>+ Add Member</button>
    </div>
  );
}`,
    breakdown: [
      "Manages dynamic collection rows using immutable array operations.",
      "Each member item has a stable unique ID (Date.now()) ensuring input focus is preserved on deletions.",
      "Disallows removing the last remaining row (disabled={form.members.length === 1}).",
      "Field updates update only the matching row ID via array.map."
    ],
    expectedOutput: `Users dynamically add and remove member rows without affecting existing input values.`
  },
  {
    id: "react-ex-30",
    title: "Notification Toast Queue Dispatcher with Auto-Dismiss Timers",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "A centralized notification toast system maintaining a queue of active alerts with automatic timer dismissals and manual dismiss actions.",
    conceptsCovered: [
      "Toast Notification Queue",
      "Auto-Dismiss Timeout Handlers",
      "Queue Insertion & Removal",
      "Unique Notification IDs"
    ],
    code: `import { useReducer, useEffect } from 'react';

function toastReducer(toasts, action) {
  switch (action.type) {
    case 'ADD_TOAST':
      return [...toasts, action.toast];
    case 'REMOVE_TOAST':
      return toasts.filter(t => t.id !== action.id);
    default:
      return toasts;
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const showToast = (message, type = 'info', duration = 3000) => {
    const id = \`toast-\${Date.now()}-\${Math.random()}\`;
    dispatch({ type: 'ADD_TOAST', toast: { id, message, type } });

    // Auto-dismiss after duration
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id });
    }, duration);
  };

  return (
    <div>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={\`toast toast-\${toast.type}\`}>
            <span>{toast.message}</span>
            <button onClick={() => dispatch({ type: 'REMOVE_TOAST', id: toast.id })}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}`,
    breakdown: [
      "toasts array holds current visible banners.",
      "showToast generates unique ID and pushes to reducer.",
      "setTimeout automatically enqueues REMOVE_TOAST after configured milliseconds.",
      "Manual cross button allows immediate user dismissal before timer expires."
    ],
    expectedOutput: `Toast notifications appear in a fixed floating container and disappear automatically after 3s.`
  },
  {
    id: "react-ex-31",
    title: "Infinite Undo Canvas State with Action Compression",
    category: "Complex State & Reducers",
    difficulty: "advanced",
    whatThisCodeCovers: "Optimizes drawing canvas history by compressing continuous mouse drag events into single discrete undo/redo steps.",
    conceptsCovered: [
      "Action Coalescing / Compression",
      "Drawing Canvas History",
      "High-Frequency State Optimization",
      "Undo Step Aggregation"
    ],
    code: `import { useReducer } from 'react';

function canvasReducer(state, action) {
  switch (action.type) {
    case 'START_STROKE':
      // Begin new path: push previous canvas state to history
      return {
        ...state,
        history: [...state.history, state.lines],
        currentStroke: [action.point]
      };
    case 'APPEND_POINT':
      // Coalesce continuous mousemove points into currentStroke without history bloat!
      return {
        ...state,
        currentStroke: [...state.currentStroke, action.point]
      };
    case 'END_STROKE':
      // Commit completed stroke as a single line
      return {
        ...state,
        lines: [...state.lines, state.currentStroke],
        currentStroke: []
      };
    case 'UNDO': {
      if (state.history.length === 0) return state;
      const previousLines = state.history[state.history.length - 1];
      return {
        ...state,
        lines: previousLines,
        history: state.history.slice(0, -1)
      };
    }
    default:
      return state;
  }
}`,
    breakdown: [
      "Instead of pushing 500 mousemove events into history, APPEND_POINT mutates only the temporary currentStroke.",
      "START_STROKE preserves the previous snapshot once.",
      "END_STROKE commits the entire line path as a single atomic drawing stroke.",
      "Undo rolls back the entire pencil stroke at once rather than undoing 1 pixel per click."
    ],
    expectedOutput: `Drawing on canvas records continuous strokes while single Undo click removes the full stroke.`
  },
  {
    id: "react-ex-32",
    title: "Audio Playlist State Machine with Play, Pause, Next & Shuffle",
    category: "Complex State & Reducers",
    difficulty: "intermediate",
    whatThisCodeCovers: "A media playlist state machine orchestrating track indexing, playback state, loop modes, and Fisher-Yates array shuffling.",
    conceptsCovered: [
      "Audio Playlist Engine",
      "Array Shuffling Algorithm",
      "Playback State Synchronization",
      "Track Index Wrapping"
    ],
    code: `import { useReducer } from 'react';

const initialPlaylistState = {
  tracks: ['Song 1', 'Song 2', 'Song 3', 'Song 4'],
  currentIndex: 0,
  isPlaying: false,
  isShuffled: false
};

function playlistReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    case 'NEXT_TRACK': {
      const nextIndex = (state.currentIndex + 1) % state.tracks.length;
      return { ...state, currentIndex: nextIndex, isPlaying: true };
    }
    case 'PREV_TRACK': {
      const prevIndex = (state.currentIndex - 1 + state.tracks.length) % state.tracks.length;
      return { ...state, currentIndex: prevIndex, isPlaying: true };
    }
    case 'SHUFFLE': {
      // Fisher-Yates array shuffle
      const shuffled = [...state.tracks];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...state, tracks: shuffled, currentIndex: 0, isShuffled: true };
    }
    default:
      return state;
  }
}`,
    breakdown: [
      "Uses modulo arithmetic ((currentIndex + 1) % length) to wrap cleanly from the last track to the first.",
      "PREV_TRACK safely handles negative offsets using (currentIndex - 1 + length) % length.",
      "SHUFFLE executes immutable Fisher-Yates randomization on the tracks array.",
      "Centralizes audio player controls into predictable, testable action transitions."
    ],
    expectedOutput: `Player cycles through tracks seamlessly, looping back to start and supporting shuffle mode.`
  }
];
