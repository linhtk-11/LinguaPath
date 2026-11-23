import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  Volume2,
  ArrowRight,
} from 'lucide-react';
import { DayQuizResult, VocabEntry } from '../types/curriculum';
import { normalizeAnswer } from '../utils/planGenerator';
import { speakEnglish } from '../utils/speech';

interface QuizQuestion {
  id: string;
  vocab: VocabEntry;
  mode: 'mcq_vi' | 'mcq_en' | 'cloze' | 'write';
  prompt: string;
  options?: string[];
  answer: string;
}

interface DayVocabQuizProps {
  dayKey: string;
  dayNumber: number;
  vocabPool: VocabEntry[];
  allCourseVocab: VocabEntry[];
  savedResult?: DayQuizResult;
  starredIds: string[];
  isDayCompleted: boolean;
  onSaveResult: (dayKey: string, result: DayQuizResult) => void;
  onToggleStar: (vocabId: string) => void;
  onMarkDayCompleted: () => void;
  onOpenQuizlet: () => void;
}

const MIN_QUESTIONS = 20;

export const DayVocabQuiz: React.FC<DayVocabQuizProps> = ({
  dayKey,
  dayNumber,
  vocabPool,
  allCourseVocab,
  savedResult,
  starredIds,
  isDayCompleted,
  onSaveResult,
  onToggleStar,
  onMarkDayCompleted,
  onOpenQuizlet,
}) => {
  const [seed, setSeed] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions: QuizQuestion[] = useMemo(() => {
    const basePool = vocabPool.length > 0 ? vocabPool : allCourseVocab;
    if (basePool.length === 0) return [];

    const distractorBase = allCourseVocab.length >= 4 ? allCourseVocab : basePool;
    const shuffledPrimary = [...basePool].sort(() => Math.random() - 0.5);

    // Ensure minimum 20 questions per post-session test
    const targetCount = Math.max(MIN_QUESTIONS, Math.min(30, shuffledPrimary.length));
    const slots: Array<{ vocab: VocabEntry; round: number }> = [];

    for (let i = 0; i < targetCount; i++) {
      const round = Math.floor(i / shuffledPrimary.length);
      const item = shuffledPrimary[i % shuffledPrimary.length];
      slots.push({ vocab: item, round });
    }

    const modesByRound: Array<QuizQuestion['mode'][]> = [
      ['mcq_vi', 'cloze', 'mcq_en', 'write'],
      ['write', 'mcq_en', 'mcq_vi', 'cloze'],
      ['cloze', 'write', 'mcq_vi', 'mcq_en'],
    ];

    return slots.map(({ vocab: v, round }, idx) => {
      const roundModes = modesByRound[round % modesByRound.length];
      const mode = roundModes[idx % roundModes.length];

      if (mode === 'mcq_vi') {
        const others = distractorBase
          .filter((d) => d.id !== v.id && d.vietnamese !== v.vietnamese)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.vietnamese);
        const options = [v.vietnamese, ...others].sort(() => Math.random() - 0.5);
        return {
          id: `q-${idx}-${v.id}-${seed}`,
          vocab: v,
          mode,
          prompt: `Chọn nghĩa tiếng Việt đúng cho "${v.term}" (${v.definition}):`,
          options,
          answer: v.vietnamese,
        };
      }

      if (mode === 'mcq_en') {
        const others = distractorBase
          .filter((d) => d.id !== v.id && d.term !== v.term)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.term);
        const options = [v.term, ...others].sort(() => Math.random() - 0.5);
        return {
          id: `q-${idx}-${v.id}-${seed}`,
          vocab: v,
          mode,
          prompt: `Từ/cụm từ nào có nghĩa là "${v.vietnamese}" (${v.definition})?`,
          options,
          answer: v.term,
        };
      }

      if (mode === 'cloze') {
        const cleanTerm = v.term.replace(/\s*\(.*?\)\s*/g, '').trim();
        const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const masked = v.example.replace(new RegExp(escaped, 'i'), '___');
        const others = distractorBase
          .filter((d) => d.id !== v.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map((d) => d.term);
        const options = [v.term, ...others].sort(() => Math.random() - 0.5);
        return {
          id: `q-${idx}-${v.id}-${seed}`,
          vocab: v,
          mode,
          prompt:
            masked !== v.example
              ? `Điền từ phù hợp vào câu: "${masked}"`
              : `Chọn từ khớp với định nghĩa: "${v.definition}"`,
          options,
          answer: v.term,
        };
      }

      return {
        id: `q-${idx}-${v.id}-${seed}`,
        vocab: v,
        mode: 'write',
        prompt: `Gõ từ tiếng Anh có nghĩa: "${v.vietnamese}" (${v.definition})`,
        answer: v.term,
      };
    });
  }, [vocabPool, allCourseVocab, seed]);

  if (questions.length === 0) return null;

  const isQuestionCorrect = (q: QuizQuestion) => {
    const userAns = responses[q.id] ?? '';
    if (q.mode === 'write') {
      const cleanTarget = q.answer.replace(/\s*\(.*?\)\s*/g, '').trim();
      return (
        normalizeAnswer(userAns) === normalizeAnswer(q.answer) ||
        normalizeAnswer(userAns) === normalizeAnswer(cleanTarget)
      );
    }
    return normalizeAnswer(userAns) === normalizeAnswer(q.answer);
  };

  const handleSubmit = () => {
    let score = 0;
    const missedSet = new Set<string>();
    for (const q of questions) {
      if (isQuestionCorrect(q)) {
        score += 1;
      } else {
        missedSet.add(q.vocab.id);
      }
    }
    setSubmitted(true);
    onSaveResult(dayKey, {
      score,
      total: questions.length,
      completedAt: new Date().toISOString(),
      missedIds: Array.from(missedSet),
    });
  };

  const handleRetake = () => {
    setResponses({});
    setSubmitted(false);
    setSeed((s) => s + 1);
  };

  const answeredCount = questions.filter((q) => (responses[q.id] ?? '').trim().length > 0).length;
  const currentScore = submitted
    ? questions.filter((q) => isQuestionCorrect(q)).length
    : savedResult?.score;
  const currentTotal = submitted ? questions.length : savedResult?.total;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Kiểm tra từ vựng cuối buổi · Ngày {dayNumber}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
            {questions.length} câu hỏi (trắc nghiệm nghĩa, chọn từ, điền câu và gõ nhớ từ).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {typeof currentScore === 'number' && typeof currentTotal === 'number' && (
            <span className="text-sm font-semibold text-emerald-700 tabular-nums">
              Kết quả: {currentScore}/{currentTotal}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenQuizlet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap shrink-0"
          >
            Ôn lại bằng Quizlet
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {questions.map((q, idx) => {
          const userVal = responses[q.id] ?? '';
          const correct = submitted && isQuestionCorrect(q);
          const wrong = submitted && !correct;
          const isStarred = starredIds.includes(q.vocab.id);

          return (
            <div key={q.id} className="py-4 first:pt-2 last:pb-2 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  <span className="font-mono text-xs text-slate-400 mr-2 tabular-nums">
                    {idx + 1}.
                  </span>
                  {q.prompt}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakEnglish(q.vocab.term)}
                    title="Nghe từ"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStar(q.vocab.id)}
                    title="Gắn sao"
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      isStarred
                        ? 'bg-amber-50 border-amber-300 text-amber-500'
                        : 'border-slate-200 text-slate-400 hover:text-amber-500'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {q.options ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
                  {q.options.map((opt) => {
                    const selected = userVal === opt;
                    const optIsRight = submitted && normalizeAnswer(opt) === normalizeAnswer(q.answer);
                    const optIsWrong = submitted && selected && !optIsRight;

                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={submitted}
                        onClick={() => setResponses((prev) => ({ ...prev, [q.id]: opt }))}
                        className={`text-left px-3.5 py-2 rounded-lg border text-sm transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                          optIsRight
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                            : optIsWrong
                            ? 'bg-red-50 border-red-400 text-red-900'
                            : selected
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-medium'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span>{opt}</span>
                        {optIsRight && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        {optIsWrong && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  disabled={submitted}
                  value={userVal}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Nhập từ tiếng Anh..."
                  className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                />
              )}

              {submitted && (
                <div className="text-xs flex flex-wrap items-center gap-2">
                  {correct ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Chính xác
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                      <XCircle className="w-3.5 h-3.5" />
                      Đáp án đúng: <span className="font-mono underline">{q.answer}</span>
                    </span>
                  )}
                  <span className="text-slate-500">· &ldquo;{q.vocab.example}&rdquo;</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Nộp bài kiểm tra
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Làm đề khác
            </button>
          )}
          <span className="text-xs text-slate-500 tabular-nums">
            Đã trả lời {answeredCount}/{questions.length} câu
          </span>
        </div>

        <button
          type="button"
          onClick={onMarkDayCompleted}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
            isDayCompleted
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          {isDayCompleted ? `Đã hoàn thành Ngày ${dayNumber}` : `Hoàn thành Ngày ${dayNumber}`}
        </button>
      </div>
    </div>
  );
};
