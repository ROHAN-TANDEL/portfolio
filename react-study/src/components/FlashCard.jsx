import React, { useRef, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  HelpCircle, 
  AlertCircle, 
  Lightbulb, 
  Sparkles, 
  RotateCcw,
  BookOpen,
  ChevronRight
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';

export function FlashCard({ 
  card, 
  index, 
  totalCards, 
  cardProgress = {}, 
  onUpdateProgress,
  onNextCard 
}) {
  const answerInputRef = useRef(null);

  const topicNotes = cardProgress.topicNotes || '';
  const userAnswer = cardProgress.userAnswer || '';
  const isRevealed = cardProgress.revealed || false;
  const status = cardProgress.status || 'unseen';

  const handleTopicNotesChange = (e) => {
    onUpdateProgress(card.id, { topicNotes: e.target.value });
  };

  const handleUserAnswerChange = (e) => {
    onUpdateProgress(card.id, { userAnswer: e.target.value });
  };

  const handleToggleReveal = () => {
    onUpdateProgress(card.id, { revealed: !isRevealed });
  };

  const handleRate = (newStatus) => {
    onUpdateProgress(card.id, { 
      status: newStatus,
      revealed: true 
    });
    // Auto advance if next card available
    if (onNextCard) {
      setTimeout(() => {
        onNextCard();
      }, 250);
    }
  };

  const handleResetCard = () => {
    onUpdateProgress(card.id, {
      topicNotes: '',
      userAnswer: '',
      revealed: false,
      status: 'unseen',
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-200">
      
      {/* Top Meta Bar */}
      <div className="px-6 py-3.5 bg-zinc-950/60 border-b border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full font-mono font-medium bg-zinc-800 text-zinc-300">
            #{index + 1} of {totalCards}
          </span>
          <span className="px-2.5 py-1 rounded-full font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
            {card.category}
          </span>
          {card.priority && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase ${
              card.priority === 'must-know' 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'bg-zinc-800 text-zinc-400'
            }`}>
              {card.priority}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          {status === 'mastered' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mastered
            </span>
          )}
          {status === 'learning' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-amber-400 bg-amber-950/50 border border-amber-800/40 text-xs font-medium">
              <HelpCircle className="w-3.5 h-3.5" /> In Progress
            </span>
          )}
          {status === 'review' && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-rose-400 bg-rose-950/50 border border-rose-800/40 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> Needs Review
            </span>
          )}

          <button
            onClick={handleResetCard}
            title="Clear notes and reset this card"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-6">

        {/* STEP 1: Topic Knowledge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px]">1</span>
              Topic & Concept
            </span>
            <span className="text-zinc-500 font-normal">Active Recall Primer</span>
          </div>

          <div className="bg-zinc-950/40 rounded-xl p-4 border border-zinc-800/60">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              {card.concept}
            </h2>
            
            <div className="mt-3">
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                What do you know about this topic?
              </label>
              <textarea
                value={topicNotes}
                onChange={handleTopicNotesChange}
                placeholder="Write your mental model, core purpose, or keywords you recall..."
                rows={2}
                className="w-full bg-zinc-900/70 border border-zinc-700/60 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* STEP 2: The Question & Your Understanding */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-sky-500/20 text-sky-300 text-[10px]">2</span>
              Question & Understanding
            </span>
            <span className="text-zinc-500 font-normal">Test Your Knowledge</span>
          </div>

          <div className="bg-zinc-950/40 rounded-xl p-4 md:p-5 border border-zinc-800/60 space-y-3">
            <div className="text-base md:text-lg font-medium text-zinc-100 leading-snug">
              {card.question}
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Your answer / explanation:
              </label>
              <textarea
                ref={answerInputRef}
                value={userAnswer}
                onChange={handleUserAnswerChange}
                placeholder="Type your explanation, syntax, or reasoning before checking the solution..."
                rows={3}
                className="w-full bg-zinc-900/70 border border-zinc-700/60 rounded-lg p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-y"
              />
            </div>
          </div>
        </div>

        {/* Primary Action Button (Flip / Reveal) */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={handleToggleReveal}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all shadow-lg active:scale-[0.99] cursor-pointer ${
              isRevealed
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:shadow-indigo-600/30'
            }`}
          >
            {isRevealed ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Hide Solution</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Reveal & Cross-Check Answer</span>
                <kbd className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] bg-indigo-700/60 text-indigo-200 border border-indigo-400/30">
                  ⌘ + ↵
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* STEP 3: Reveal & Cross-Check View */}
        {isRevealed && (
          <div className="pt-2 space-y-5 animate-in fade-in duration-300">
            
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">3</span>
                Cross-Check Answers
              </span>
              <span className="text-emerald-500/80 font-normal">Compare your answer with the source</span>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: What You Wrote */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 flex flex-col">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Your Answer
                </div>
                <div className="flex-1 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                  {userAnswer.trim() ? (
                    userAnswer
                  ) : (
                    <span className="text-zinc-500 italic">You didn't write an answer for this question.</span>
                  )}
                </div>
                {topicNotes.trim() && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                      Your Topic Notes:
                    </span>
                    <p className="text-xs text-zinc-300 italic">
                      "{topicNotes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Actual Answer */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col">
                <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Actual Answer
                </div>
                <div className="flex-1 text-sm text-emerald-100 font-medium leading-relaxed whitespace-pre-wrap">
                  {card.answer}
                </div>
              </div>

            </div>

            {/* Code Snippet if present */}
            {card.code && (
              <CodeViewer code={card.code} />
            )}

            {/* Explanation */}
            {card.explanation && (
              <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
                <span className="font-semibold text-zinc-100 block mb-1 text-xs uppercase tracking-wider text-indigo-300">
                  Detailed Explanation:
                </span>
                {card.explanation}
              </div>
            )}

            {/* Recall Hint */}
            {card.recallHint && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 text-amber-200 text-sm">
                <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-amber-300 mr-2 text-xs uppercase tracking-wider">Memory Peg:</span>
                  <span>{card.recallHint}</span>
                </div>
              </div>
            )}

            {/* Practice Questions */}
            {card.practice && card.practice.length > 0 && (
              <div className="bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Practice Challenges & Follow-ups</span>
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-300 pl-4 list-disc">
                  {card.practice.map((item, pIdx) => (
                    <li key={pIdx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Self-Evaluation Bar */}
            <div className="pt-3 border-t border-zinc-800/80">
              <div className="text-center text-xs font-medium text-zinc-400 mb-3">
                How well did you understand this concept?
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleRate('review')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    status === 'review'
                      ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                      : 'bg-zinc-900/80 hover:bg-rose-950/30 text-rose-300 border-rose-900/40 hover:border-rose-700/60'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Needs Work</span>
                  <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded text-[10px] bg-zinc-800/80 text-zinc-400">1</kbd>
                </button>

                <button
                  onClick={() => handleRate('learning')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    status === 'learning'
                      ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/20 font-bold'
                      : 'bg-zinc-900/80 hover:bg-amber-950/30 text-amber-300 border-amber-900/40 hover:border-amber-700/60'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Almost / Okay</span>
                  <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded text-[10px] bg-zinc-800/80 text-zinc-400">2</kbd>
                </button>

                <button
                  onClick={() => handleRate('mastered')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    status === 'mastered'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-900/80 hover:bg-emerald-950/30 text-emerald-300 border-emerald-900/40 hover:border-emerald-700/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mastered</span>
                  <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded text-[10px] bg-zinc-800/80 text-zinc-400">3</kbd>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
