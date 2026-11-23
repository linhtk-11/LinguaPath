import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Sparkles,
  Check,
  Loader2,
} from 'lucide-react';
import { ExerciseBlock, ExerciseItem, ExerciseSavedState } from '../types/curriculum';
import { checkUserAnswer } from '../utils/planGenerator';

interface ExerciseInteractiveProps {
  block: ExerciseBlock;
  unitTitle: string;
  savedState?: ExerciseSavedState;
  onSaveState: (blockId: string, state: ExerciseSavedState) => void;
}

export const ExerciseInteractive: React.FC<ExerciseInteractiveProps> = ({
  block,
  unitTitle,
  savedState,
  onSaveState,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>(savedState?.answers ?? {});
  const [checked, setChecked] = useState<boolean>(savedState?.checked ?? false);
  const [revealed, setRevealed] = useState<boolean>(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(
    block.items[0]?.id ?? null
  );
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplainId, setLoadingExplainId] = useState<string | null>(null);
  const [explainError, setExplainError] = useState<Record<string, string>>({});

  const totalCount = block.items.length;

  const computeScore = (ansMap: Record<string, string>) => {
    let correct = 0;
    for (const item of block.items) {
      if (checkUserAnswer(ansMap[item.id] ?? '', item.answer)) {
        correct += 1;
      }
    }
    return correct;
  };

  const handleChange = (itemId: string, value: string) => {
    const next = { ...answers, [itemId]: value };
    setAnswers(next);
    if (checked) setChecked(false);
    onSaveState(block.id, {
      answers: next,
      checked: false,
      correctCount: computeScore(next),
      totalCount,
    });
  };

  const handleWordBankClick = (word: string) => {
    const targetId =
      activeItemId ||
      block.items.find((it) => !(answers[it.id] ?? '').trim())?.id ||
      block.items[0]?.id;
    if (!targetId) return;
    handleChange(targetId, word);
    const currentIdx = block.items.findIndex((it) => it.id === targetId);
    const nextEmpty = block.items
      .slice(currentIdx + 1)
      .find((it) => !(answers[it.id] ?? '').trim());
    if (nextEmpty) {
      setActiveItemId(nextEmpty.id);
    }
  };

  const handleCheck = () => {
    const correctCount = computeScore(answers);
    setChecked(true);
    onSaveState(block.id, {
      answers,
      checked: true,
      correctCount,
      totalCount,
    });
  };

  const handleReset = () => {
    setAnswers({});
    setChecked(false);
    setRevealed(false);
    setExplanations({});
    setExplainError({});
    onSaveState(block.id, {
      answers: {},
      checked: false,
      correctCount: 0,
      totalCount,
    });
  };

  const handleExplain = async (item: ExerciseItem) => {
    if (explanations[item.id]) return;
    setLoadingExplainId(item.id);
    setExplainError((prev) => ({ ...prev, [item.id]: '' }));
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: item.prompt,
          answer: item.answer.split('|')[0],
          userAnswer: answers[item.id] ?? '',
          unitTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lấy giải thích từ AI.');
      }
      setExplanations((prev) => ({ ...prev, [item.id]: data.explanation }));
    } catch (err) {
      setExplainError((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : 'Lỗi kết nối AI.',
      }));
    } finally {
      setLoadingExplainId(null);
    }
  };

  const correctCount = checked ? computeScore(answers) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h4 className="text-base font-bold text-slate-900">
            Bài {block.label}: {block.title}
          </h4>
        </div>
        {checked && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Đúng {correctCount}/{totalCount}
          </span>
        )}
      </div>

      {block.contextPassage && (
        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
          {block.contextPassage}
        </div>
      )}

      {block.wordBank && block.wordBank.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">
            Chọn từ gợi ý để điền nhanh:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {block.wordBank.map((word) => {
              const isUsed = Object.values(answers).some(
                (v) => v.trim().toLowerCase() === word.trim().toLowerCase()
              );
              return (
                <button
                  key={word}
                  type="button"
                  onClick={() => handleWordBankClick(word)}
                  className={`px-3 py-1 text-sm font-mono rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isUsed
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-400'
                  }`}
                >
                  {word}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clean row dividers instead of nested cards */}
      <div className="mt-4 divide-y divide-slate-100">
        {block.items.map((item) => {
          const userVal = answers[item.id] ?? '';
          const isCorrect = checked && checkUserAnswer(userVal, item.answer);
          const isWrong = checked && !isCorrect;
          const primaryAnswer = item.answer.split('|')[0];

          return (
            <div key={item.id} className="py-4 first:pt-2 last:pb-2">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-slate-400 pt-1 w-6 shrink-0 tabular-nums">
                  {item.number}.
                </span>
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="text-sm sm:text-[15px] text-slate-900 leading-relaxed flex flex-wrap items-center gap-2">
                    <span>{item.prompt}</span>
                    {item.keyword && (
                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {item.keyword}
                      </span>
                    )}
                  </div>

                  {item.options && item.options.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
                      {item.options.map((opt) => {
                        const selected = userVal === opt;
                        const optCorrect = checked && checkUserAnswer(opt, item.answer);
                        const optWrongSelected = checked && selected && !optCorrect;

                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleChange(item.id, opt)}
                            className={`text-left px-3.5 py-2 rounded-lg border text-sm transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                              optCorrect
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-medium'
                                : optWrongSelected
                                ? 'bg-red-50 border-red-400 text-red-900'
                                : selected
                                ? 'bg-blue-50 border-blue-600 text-blue-900 font-medium'
                                : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span>{opt}</span>
                            {optCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {optWrongSelected && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={userVal}
                        onFocus={() => setActiveItemId(item.id)}
                        onChange={(e) => handleChange(item.id, e.target.value)}
                        placeholder="Nhập đáp án..."
                        className={`w-full sm:w-80 px-3 py-2 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 transition-shadow ${
                          isCorrect
                            ? 'border-emerald-500 focus:ring-emerald-100 text-emerald-900'
                            : isWrong
                            ? 'border-red-400 focus:ring-red-100 text-red-900'
                            : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100 text-slate-900'
                        }`}
                      />
                      {isCorrect && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          Đúng
                        </span>
                      )}
                      {isWrong && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                          <XCircle className="w-4 h-4 shrink-0" />
                          Sai
                        </span>
                      )}
                    </div>
                  )}

                  {(revealed || isWrong) && (
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-600">
                        Đáp án:{' '}
                        <strong className="font-mono text-emerald-700">
                          {primaryAnswer}
                        </strong>
                        {item.answer.includes('|') && (
                          <span className="text-slate-400 ml-1">
                            ({item.answer.split('|').slice(1).join(' / ')})
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExplain(item)}
                        disabled={loadingExplainId === item.id}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline font-medium cursor-pointer disabled:opacity-50"
                      >
                        {loadingExplainId === item.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {explanations[item.id] ? 'Đã giải thích' : 'Giải thích AI'}
                      </button>
                    </div>
                  )}

                  {explainError[item.id] && (
                    <p className="text-xs text-red-600">{explainError[item.id]}</p>
                  )}

                  {explanations[item.id] && (
                    <p className="text-xs sm:text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed whitespace-pre-line">
                      {explanations[item.id]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Kiểm tra
          </button>
          <button
            type="button"
            onClick={() => setRevealed((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            {revealed ? 'Ẩn đáp án' : 'Xem đáp án'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Làm lại
          </button>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          Đã làm {block.items.filter((it) => (answers[it.id] ?? '').trim().length > 0).length}/{totalCount}
        </span>
      </div>
    </div>
  );
};
