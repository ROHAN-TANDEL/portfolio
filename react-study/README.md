# FlashLearn — Interactive Flashcard Study App

A lightweight, distraction-free, configuration-driven interactive learning app built with **React**, **Vite**, and **Tailwind CSS**.

---

## ⚡ Active Recall Workflow

Each flashcard follows a proven 3-step active recall loop:

1. **Step 1 — Topic & Concept Primer**:
   - See the concept name (e.g., `Dynamic Typing`).
   - Write down what you already know in your own words.
2. **Step 2 — Question & Your Understanding**:
   - Read the question (e.g., `What does dynamically typed mean in JavaScript?`).
   - Enter your explanation, mental model, or code notes before checking.
3. **Step 3 — Reveal & Cross-Check**:
   - Compare your answer side-by-side with the official solution.
   - View formatted code snippets, in-depth explanations, and memory hints.
   - Quick 1-click self-evaluation (`Needs Work` 🔴, `Almost` 🟡, `Mastered` 🟢) to track mastery.

---

## 🚀 Running the App

```bash
# Start development server
npm run dev

# App is live at:
http://localhost:5173
```

---

## ⚙️ Adding New Topics (Configuration Driven)

To add a new subject or update topics, **no code changes are needed**:

1. Drop your JSON file into `data/` (e.g. `data/docker.json`).
   - Each item in the array supports:
   ```json
   {
     "id": "doc-001",
     "category": "containers",
     "concept": "Docker Image vs Container",
     "priority": "must-know",
     "question": "What is the difference between an image and a container?",
     "answer": "An image is a read-only template with instructions, while a container is a runnable instance of an image.",
     "explanation": "Containers are created from images and add a thin read-write layer.",
     "recallHint": "Image = class/blueprint. Container = object/instance.",
     "code": "docker run -d -p 80:80 nginx",
     "practice": [
       "Run a detached container and inspect its logs."
     ]
   }
   ```
2. Add the subject entry to `data/subjects.json`:
   ```json
   {
     "id": "docker",
     "name": "Docker & Containers",
     "icon": "🐳",
     "description": "Images, containers, volumes, networking and compose",
     "dataFile": "docker.json"
   }
   ```
3. Refresh the page — your new topic and all its cards are ready immediately!

---

## ⌨️ Keyboard Shortcuts (Minimal Clicks)

| Shortcut | Action |
| :--- | :--- |
| `⌘ + Enter` / `Ctrl + Enter` | Reveal / Hide Solution & Cross-Check |
| `→` or `J` | Next Card |
| `←` or `K` | Previous Card |
| `1` | Mark as "Needs Work" 🔴 |
| `2` | Mark as "Almost / Learning" 🟡 |
| `3` | Mark as "Mastered" 🟢 |
| `Tab` | Quickly jump between input fields |

---

## 💾 Offline & Persistence

- All your typed notes and self-ratings are automatically saved to `localStorage`.
- Use the **Reset (↺)** button in the top navbar if you wish to restart a subject from scratch.
