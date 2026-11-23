import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Star,
  Sparkles,
  Loader2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  CourseDocument,
  DayQuizResult,
  ExerciseBlock,
  ExerciseSavedState,
  StudyPlanDay,
  StudyUnit,
  VocabCategory,
} from '../types/curriculum';
import { ExerciseInteractive } from './ExerciseInteractive';
import { DayVocabQuiz } from './DayVocabQuiz';
import { speakEnglish } from '../utils/speech';

interface LessonWorkspaceProps {
  course: CourseDocument;
  planDays: StudyPlanDay[];
  selectedDayNumber: number;
  onSelectDay: (dayNumber: number) => void;
  completedDays: number[];
  exerciseState: Record<string, ExerciseSavedState>;
  onSaveExerciseState: (blockId: string, state: ExerciseSavedState) => void;
  dayQuizResults: Record<string, DayQuizResult>;
  onSaveDayQuizResult: (dayKey: string, result: DayQuizResult) => void;
  starredVocabIds: string[];
  onToggleStar: (vocabId: string) => void;
  onMarkDayCompleted: (dayNumber: number) => void;
  onOpenQuizletForDay: (day: StudyPlanDay) => void;
}

type LessonStep = 'theory' | 'practice' | 'quiz';

const CATEGORY_TITLES: Record<VocabCategory, string> = {
  topic_vocab: 'Từ vựng chủ đề',
  phrasal_verb: 'Cụm động từ (Phrasal Verbs)',
  prepositional_phrase: 'Cụm giới từ',
  word_formation: 'Cấu tạo từ (Word Formation)',
  word_pattern: 'Mẫu câu & Giới từ đi kèm',
};

export const LessonWorkspace: React.FC<LessonWorkspaceProps> = ({
  course,
  planDays,
  selectedDayNumber,
  onSelectDay,
  completedDays,
  exerciseState,
  onSaveExerciseState,
  dayQuizResults,
  onSaveDayQuizResult,
  starredVocabIds,
  onToggleStar,
  onMarkDayCompleted,
  onOpenQuizletForDay,
}) => {
  const [step, setStep] = useState<LessonStep>('theory');
  const [aiExtraBlocks, setAiExtraBlocks] = useState<Record<string, ExerciseBlock>>({});
  const [loadingExtraUnitId, setLoadingExtraUnitId] = useState<string | null>(null);
  const [extraError, setExtraError] = useState<Record<string, string>>({});

  const day = planDays.find((d) => d.dayNumber === selectedDayNumber) ?? planDays[0];
  if (!day) return null;

  const dayKey = `${course.id}-day-${day.dayNumber}-of-${planDays.length}`;
  const isCompleted = completedDays.includes(day.dayNumber);
  const allCourseVocab = course.units.flatMap((u) => u.vocabItems ?? []);

  const switchStep = (next: LessonStep) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateExtraPractice = async (unit: StudyUnit) => {
    setLoadingExtraUnitId(unit.id);
    setExtraError((prev) => ({ ...prev, [unit.id]: '' }));
    try {
      const sampleTerms = (unit.vocabItems ?? []).map((v) => v.term);
      const res = await fetch('/api/ai/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitTitle: unit.title,
          topic: unit.topic,
          type: unit.type,
          sampleTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo bài tập bổ sung.');
      }
      const items = Array.isArray(data.items)
        ? data.items.map((it: Record<string, unknown>, idx: number) => ({
            id: `${unit.id}-ai-extra-${Date.now()}-${idx}`,
            number: Number(it.number) || idx + 1,
            prompt: String(it.prompt || ''),
            options: Array.isArray(it.options) ? it.options.map(String) : undefined,
            answer: String(it.answer || ''),
          }))
        : [];

      if (items.length === 0) {
        throw new Error('AI chưa trả về câu hỏi hợp lệ.');
      }

      setAiExtraBlocks((prev) => ({
        ...prev,
        [unit.id]: {
          id: `${unit.id}-ai-block`,
          label: 'AI+',
          title: `Luyện tập mở rộng cho ${unit.topic}`,
          kind: 'choice',
          items,
        },
      }));
    } catch (err) {
      setExtraError((prev) => ({
        ...prev,
        [unit.id]: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
      }));
    } finally {
      setLoadingExtraUnitId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Clean Day Header + Step Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={day.dayNumber <= 1}
              onClick={() => onSelectDay(day.dayNumber - 1)}
              aria-label="Ngày trước"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={day.dayNumber}
              onChange={(e) => onSelectDay(Number(e.target.value))}
              aria-label="Chọn ngày học"
              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {planDays.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Ngày {d.dayNumber}/{planDays.length}: {d.title}
                  {completedDays.includes(d.dayNumber) ? ' (Đã xong)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={day.dayNumber >= planDays.length}
              onClick={() => onSelectDay(day.dayNumber + 1)}
              aria-label="Ngày tiếp theo"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenQuizletForDay(day)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-4 h-4 text-blue-600" />
              Quizlet ({day.vocabPool.length} từ)
            </button>
            <button
              type="button"
              onClick={() => onMarkDayCompleted(day.dayNumber)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isCompleted
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isCompleted ? 'Đã xong buổi này' : 'Đánh dấu xong'}
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900">{day.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Ngày {day.dayNumber} / {planDays.length} · Dự kiến {day.estimatedMinutes} phút
          </p>
        </div>

        {/* 3 Clear Guided Steps */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => switchStep('theory')}
            className={`py-2 px-3 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
              step === 'theory'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Lý thuyết &amp; Từ vựng
          </button>
          <button
            type="button"
            onClick={() => switchStep('practice')}
            className={`py-2 px-3 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
              step === 'practice'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Làm bài tập
          </button>
          <button
            type="button"
            onClick={() => switchStep('quiz')}
            className={`py-2 px-3 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
              step === 'quiz'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Kiểm tra cuối buổi
          </button>
        </div>
      </div>

      {/* STEP 1: THEORY & VOCABULARY */}
      {step === 'theory' && (
        <div className="space-y-6">
          {day.units.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Buổi ôn tập củng cố
              </h3>
              <p className="text-sm text-slate-600">
                Hôm nay tập trung ôn lại từ vựng bằng Quizlet và làm bài kiểm tra tổng hợp ở Bước 2 &amp; Bước 3.
              </p>
            </div>
          ) : (
            day.units.map((unit) => (
              <div
                key={unit.id}
                className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6"
              >
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-xs text-slate-500">
                    {unit.title} · {unit.type === 'grammar' ? 'Ngữ pháp' : 'Từ vựng'}
                    {unit.pageRange ? ` · ${unit.pageRange}` : ''}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {unit.topic}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                    {unit.summaryVi}
                  </p>
                </div>

                {/* Grammar Sections */}
                {unit.grammarSections && unit.grammarSections.length > 0 && (
                  <div className="space-y-6">
                    {unit.grammarSections.map((sec, sIdx) => (
                      <div key={`${unit.id}-sec-${sIdx}`} className="space-y-3">
                        <h4 className="text-base font-bold text-slate-900">
                          {sec.heading}
                        </h4>
                        {sec.formSummary && (
                          <p className="font-mono text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-slate-800">
                            {sec.formSummary}
                          </p>
                        )}

                        {sec.forms && sec.forms.length > 0 && (
                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left text-xs sm:text-sm">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                <tr>
                                  <th className="py-2 px-3 font-semibold">Dạng</th>
                                  <th className="py-2 px-3 font-semibold">Khẳng định (+)</th>
                                  <th className="py-2 px-3 font-semibold">Phủ định (-)</th>
                                  <th className="py-2 px-3 font-semibold">Nghi vấn (?)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {sec.forms.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    <td className="py-2 px-3 font-medium text-slate-700">{row.label}</td>
                                    <td className="py-2 px-3 font-mono text-slate-900">{row.statement}</td>
                                    <td className="py-2 px-3 font-mono text-slate-900">{row.negative}</td>
                                    <td className="py-2 px-3 font-mono text-slate-900">{row.question}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                          {sec.uses.map((u, uIdx) => (
                            <div key={uIdx} className="p-3.5 space-y-1">
                              <p className="text-sm font-medium text-slate-900">{u.use}</p>
                              <p className="text-sm text-slate-600 italic">&ldquo;{u.example}&rdquo;</p>
                            </div>
                          ))}
                        </div>

                        {sec.helpfulHints && sec.helpfulHints.length > 0 && (
                          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 text-xs sm:text-sm text-slate-700 space-y-1">
                            <p className="font-semibold text-blue-800">Mẹo ghi nhớ:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {sec.helpfulHints.map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {sec.watchOut && sec.watchOut.length > 0 && (
                          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5 text-xs sm:text-sm text-slate-700 space-y-1">
                            <p className="font-semibold text-amber-900">Lưu ý dễ sai:</p>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {sec.watchOut.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Vocabulary Lists */}
                {unit.vocabItems && unit.vocabItems.length > 0 && (
                  <div className="space-y-5">
                    {(
                      [
                        'topic_vocab',
                        'phrasal_verb',
                        'prepositional_phrase',
                        'word_formation',
                        'word_pattern',
                      ] as VocabCategory[]
                    ).map((cat) => {
                      const rows = unit.vocabItems!.filter((v) => v.category === cat);
                      if (rows.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-800">
                            {CATEGORY_TITLES[cat]} ({rows.length})
                          </h4>
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {rows.map((item) => {
                              const isStarred = starredVocabIds.includes(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className="p-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/50"
                                >
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <span className="font-semibold text-base text-slate-900">
                                        {item.term}
                                      </span>
                                      {item.partOfSpeech && (
                                        <span className="font-mono text-xs text-slate-500">
                                          ({item.partOfSpeech})
                                        </span>
                                      )}
                                      <span className="text-sm font-medium text-blue-700">
                                        — {item.vietnamese}
                                      </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-600">
                                      {item.definition}
                                    </p>
                                    <p className="text-xs text-slate-500 italic">
                                      &ldquo;{item.example}&rdquo;
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => speakEnglish(item.term)}
                                      title="Nghe phát âm"
                                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                                    >
                                      <Volume2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onToggleStar(item.id)}
                                      title="Đánh dấu cần ôn"
                                      className={`p-1.5 rounded-lg border cursor-pointer ${
                                        isStarred
                                          ? 'bg-amber-50 border-amber-300 text-amber-500'
                                          : 'border-slate-200 text-slate-400 hover:text-amber-500'
                                      }`}
                                    >
                                      <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => switchStep('practice')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              <span>Sang Bước 2: Làm bài tập</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: INTERACTIVE PRACTICE */}
      {step === 'practice' && (
        <div className="space-y-6">
          {day.units.map((unit) => (
            <div key={unit.id} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {unit.title}: {unit.topic}
                </h3>
                <button
                  type="button"
                  onClick={() => handleGenerateExtraPractice(unit)}
                  disabled={loadingExtraUnitId === unit.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {loadingExtraUnitId === unit.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  Tạo thêm 5 câu AI
                </button>
              </div>

              {extraError[unit.id] && (
                <p className="text-xs text-red-600 px-1">{extraError[unit.id]}</p>
              )}

              {unit.exercises.map((block) => (
                <ExerciseInteractive
                  key={block.id}
                  block={block}
                  unitTitle={unit.title}
                  savedState={exerciseState[block.id]}
                  onSaveState={onSaveExerciseState}
                />
              ))}

              {aiExtraBlocks[unit.id] && (
                <ExerciseInteractive
                  key={aiExtraBlocks[unit.id].id}
                  block={aiExtraBlocks[unit.id]}
                  unitTitle={unit.title}
                  savedState={exerciseState[aiExtraBlocks[unit.id].id]}
                  onSaveState={onSaveExerciseState}
                />
              )}
            </div>
          ))}

          {day.reviewCheckpoint && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <h3 className="text-lg font-bold text-slate-900">
                  {day.reviewCheckpoint.title}
                </h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  Bài ôn tập tổng hợp (Units {day.reviewCheckpoint.coveredUnits.join(', ')}).
                </p>
              </div>
              {day.reviewCheckpoint.exercises.map((block) => (
                <ExerciseInteractive
                  key={block.id}
                  block={block}
                  unitTitle={day.reviewCheckpoint!.title}
                  savedState={exerciseState[block.id]}
                  onSaveState={onSaveExerciseState}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => switchStep('theory')}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
            >
              ← Quay lại Lý thuyết
            </button>
            <button
              type="button"
              onClick={() => switchStep('quiz')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              <span>Sang Bước 3: Kiểm tra từ vựng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: POST-SESSION VOCAB QUIZ */}
      {step === 'quiz' && (
        <div className="space-y-5">
          <DayVocabQuiz
            dayKey={dayKey}
            dayNumber={day.dayNumber}
            vocabPool={day.vocabPool}
            allCourseVocab={allCourseVocab}
            savedResult={dayQuizResults[dayKey]}
            starredIds={starredVocabIds}
            isDayCompleted={isCompleted}
            onSaveResult={onSaveDayQuizResult}
            onToggleStar={onToggleStar}
            onMarkDayCompleted={() => onMarkDayCompleted(day.dayNumber)}
            onOpenQuizlet={() => onOpenQuizletForDay(day)}
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => switchStep('practice')}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
            >
              ← Quay lại Làm bài tập
            </button>
            {day.dayNumber < planDays.length && (
              <button
                type="button"
                onClick={() => {
                  onSelectDay(day.dayNumber + 1);
                  switchStep('theory');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
              >
                <span>Học tiếp Ngày {day.dayNumber + 1}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
