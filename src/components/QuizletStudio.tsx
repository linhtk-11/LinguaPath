import React, { useEffect, useMemo, useState } from 'react';
import {
  Volume2,
  Star,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Lightbulb,
  BookOpen,
  Layers,
  ClipboardCheck,
} from 'lucide-react';
import { VocabEntry, VocabMasteryStatus } from '../types/curriculum';
import { speakEnglish } from '../utils/speech';
import { normalizeAnswer } from '../utils/planGenerator';

type PrimarySection = 'cards' | 'test';
type CardStudyMode = 'flashcards' | 'learn' | 'match' | 'write';
type FilterScope = 'all' | 'unmastered' | 'starred';

interface QuizletStudioProps {
  scopeKey: string;
  scopeTitle: string;
  vocabPool: VocabEntry[];
  allCourseVocab: VocabEntry[];
  vocabMastery: Record<string, VocabMasteryStatus>;
  starredIds: string[];
  matchBestTimeMs: Record<string, number>;
  onSetMastery: (vocabId: string, status: VocabMasteryStatus) => void;
  onToggleStar: (vocabId: string) => void;
  onUpdateMatchBest: (scopeKey: string, timeMs: number) => void;
}

export const QuizletStudio: React.FC<QuizletStudioProps> = ({
  scopeKey,
  scopeTitle,
  vocabPool,
  allCourseVocab,
  vocabMastery,
  starredIds,
  matchBestTimeMs,
  onSetMastery,
  onToggleStar,
  onUpdateMatchBest,
}) => {
  const [section, setSection] = useState<PrimarySection>('cards');
  const [cardMode, setCardMode] = useState<CardStudyMode>('flashcards');
  const [filterScope, setFilterScope] = useState<FilterScope>('all');

  const filteredCards = useMemo(() => {
    if (filterScope === 'starred') {
      return vocabPool.filter((v) => starredIds.includes(v.id));
    }
    if (filterScope === 'unmastered') {
      return vocabPool.filter((v) => vocabMastery[v.id] !== 'mastered');
    }
    return vocabPool;
  }, [vocabPool, filterScope, starredIds, vocabMastery]);

  const masteredCount = vocabPool.filter((v) => vocabMastery[v.id] === 'mastered').length;
  const starredCount = vocabPool.filter((v) => starredIds.includes(v.id)).length;

  if (vocabPool.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <BookOpen className="w-7 h-7 text-slate-400 mx-auto mb-2" />
        <p className="text-base font-semibold text-slate-900">Chưa có từ vựng cho mục này</p>
        <p className="text-sm text-slate-500 mt-1">
          Hãy chọn một Unit từ vựng hoặc toàn bộ khóa học ở thanh phía trên.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Main Quizlet Mode Switch: Học theo thẻ vs Kiểm tra */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 leading-snug">{scopeTitle}</h3>
          <p className="text-xs sm:text-sm text-slate-500 tabular-nums">
            {vocabPool.length} thẻ · Đã thuộc {masteredCount}/{vocabPool.length} · Gắn sao {starredCount}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSection('cards')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
              section === 'cards'
                ? 'bg-blue-50 border-blue-600 text-blue-950'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                section === 'cards' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">Học theo thẻ</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Flashcards, Learn, Match, Write
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSection('test')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
              section === 'test'
                ? 'bg-blue-50 border-blue-600 text-blue-950'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                section === 'test' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight">Kiểm tra (Quiz)</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Trắc nghiệm từ vựng 4 đáp án nghĩa
              </div>
            </div>
          </button>
        </div>

        {/* Sub-toolbar when in "Học theo thẻ" */}
        {section === 'cards' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['flashcards', 'Flashcards'],
                  ['learn', 'Learn'],
                  ['match', 'Match'],
                  ['write', 'Write'],
                ] as [CardStudyMode, string][]
              ).map(([mKey, mLabel]) => (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => setCardMode(mKey)}
                  className={`px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    cardMode === mKey
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {mLabel}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">Lọc:</span>
              <button
                type="button"
                onClick={() => setFilterScope('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  filterScope === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tất cả ({vocabPool.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('unmastered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  filterScope === 'unmastered'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Chưa thuộc ({vocabPool.length - masteredCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('starred')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                  filterScope === 'starred'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Gắn sao ({starredCount})
              </button>
            </div>
          </div>
        )}
      </div>

      {section === 'cards' ? (
        filteredCards.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
            <p className="text-base font-semibold text-slate-900">
              Không còn thẻ nào trong bộ lọc này
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Chọn &ldquo;Tất cả&rdquo; để xem lại toàn bộ từ vựng.
            </p>
          </div>
        ) : (
          <>
            {cardMode === 'flashcards' && (
              <FlashcardsMode
                cards={filteredCards}
                vocabMastery={vocabMastery}
                starredIds={starredIds}
                onSetMastery={onSetMastery}
                onToggleStar={onToggleStar}
              />
            )}
            {cardMode === 'learn' && (
              <LearnMode
                cards={filteredCards}
                distractorPool={allCourseVocab.length >= 4 ? allCourseVocab : vocabPool}
                onSetMastery={onSetMastery}
              />
            )}
            {cardMode === 'match' && (
              <MatchMode
                scopeKey={scopeKey}
                cards={filteredCards}
                bestTimeMs={matchBestTimeMs[scopeKey]}
                onUpdateBest={onUpdateMatchBest}
              />
            )}
            {cardMode === 'write' && (
              <WriteMode cards={filteredCards} onSetMastery={onSetMastery} />
            )}
          </>
        )
      ) : (
        <QuizletTestMode
          cards={vocabPool}
          distractorPool={allCourseVocab.length >= 4 ? allCourseVocab : vocabPool}
          starredIds={starredIds}
          onSetMastery={onSetMastery}
          onToggleStar={onToggleStar}
          onReviewMissedWithCards={() => {
            setFilterScope('unmastered');
            setCardMode('flashcards');
            setSection('cards');
          }}
        />
      )}
    </div>
  );
};

/* ---------------------- QUIZLET TEST MODE (KIỂM TRA) ---------------------- */
interface TestMeaningOption {
  vocabId: string;
  vietnamese: string;
  definition: string;
}

interface TestMCQQuestion {
  id: string;
  vocab: VocabEntry;
  options: TestMeaningOption[];
}

const QuizletTestMode: React.FC<{
  cards: VocabEntry[];
  distractorPool: VocabEntry[];
  starredIds: string[];
  onSetMastery: (id: string, status: VocabMasteryStatus) => void;
  onToggleStar: (id: string) => void;
  onReviewMissedWithCards: () => void;
}> = ({
  cards,
  distractorPool,
  starredIds,
  onSetMastery,
  onToggleStar,
  onReviewMissedWithCards,
}) => {
  const [questionCount, setQuestionCount] = useState<number>(() =>
    Math.min(20, Math.max(1, cards.length))
  );
  const [customCardsSubset, setCustomCardsSubset] = useState<VocabEntry[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setCustomCardsSubset(null);
    setQuestionCount(Math.min(20, Math.max(1, cards.length)));
    setSelectedAnswers({});
    setSubmitted(false);
    setSeed((s) => s + 1);
  }, [cards]);

  const sourceList = customCardsSubset && customCardsSubset.length > 0 ? customCardsSubset : cards;

  const questions: TestMCQQuestion[] = useMemo(() => {
    if (sourceList.length === 0) return [];

    const desiredTotal = Math.min(questionCount, sourceList.length);
    const picked = [...sourceList].sort(() => Math.random() - 0.5).slice(0, desiredTotal);
    const pool = distractorPool.length >= 4 ? distractorPool : sourceList;

    return picked.map((v, idx) => {
      const seenMeanings = new Set<string>([v.vietnamese.trim().toLowerCase()]);
      const distractors: TestMeaningOption[] = [];

      const candidates = [...pool]
        .filter((d) => d.id !== v.id)
        .sort(() => Math.random() - 0.5);

      for (const cand of candidates) {
        const key = cand.vietnamese.trim().toLowerCase();
        if (!seenMeanings.has(key)) {
          seenMeanings.add(key);
          distractors.push({
            vocabId: cand.id,
            vietnamese: cand.vietnamese,
            definition: cand.definition,
          });
        }
        if (distractors.length === 3) break;
      }

      const correctOpt: TestMeaningOption = {
        vocabId: v.id,
        vietnamese: v.vietnamese,
        definition: v.definition,
      };

      const options = [correctOpt, ...distractors].sort(() => Math.random() - 0.5);

      return {
        id: `qtest-${idx}-${v.id}-${seed}`,
        vocab: v,
        options,
      };
    });
  }, [sourceList, distractorPool, questionCount, seed]);

  const scoreSummary = useMemo(() => {
    let correct = 0;
    let answered = 0;
    const missedVocabs: VocabEntry[] = [];
    const correctVocabs: VocabEntry[] = [];

    for (const q of questions) {
      const chosenVocabId = selectedAnswers[q.id] ?? '';
      if (chosenVocabId) answered += 1;
      if (chosenVocabId === q.vocab.id) {
        correct += 1;
        correctVocabs.push(q.vocab);
      } else {
        missedVocabs.push(q.vocab);
      }
    }

    const total = questions.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, answered, pct, missedVocabs, correctVocabs };
  }, [questions, selectedAnswers]);

  const handleSubmitTest = () => {
    setSubmitted(true);
    scoreSummary.correctVocabs.forEach((v) => onSetMastery(v.id, 'mastered'));
    scoreSummary.missedVocabs.forEach((v) => onSetMastery(v.id, 'learning'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetakeMissed = () => {
    if (scoreSummary.missedVocabs.length === 0) return;
    setCustomCardsSubset(scoreSummary.missedVocabs);
    setQuestionCount(scoreSummary.missedVocabs.length);
    setSelectedAnswers({});
    setSubmitted(false);
    setSeed((s) => s + 1);
  };

  const handleNewFullTest = () => {
    setCustomCardsSubset(null);
    setQuestionCount((prev) => Math.min(prev, cards.length));
    setSelectedAnswers({});
    setSubmitted(false);
    setSeed((s) => s + 1);
  };

  return (
    <div className="space-y-5">
      {/* Configuration Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-slate-900">
            {customCardsSubset
              ? `Ôn lại các từ làm sai (${customCardsSubset.length} câu)`
              : 'Kiểm tra từ vựng (Chọn nghĩa đúng)'}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Xem từ vựng và chọn 1 trong 4 đáp án nghĩa đúng. Từ đúng được đánh dấu Đã thuộc, từ sai chuyển sang Cần ôn lại.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <label htmlFor="quizlet-test-count" className="text-xs font-medium text-slate-600">
              Số câu:
            </label>
            <select
              id="quizlet-test-count"
              value={questionCount}
              onChange={(e) => {
                setCustomCardsSubset(null);
                setQuestionCount(Number(e.target.value));
                setSelectedAnswers({});
                setSubmitted(false);
                setSeed((s) => s + 1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 tabular-nums"
            >
              {[10, 20, 30, 40]
                .filter((n) => n < cards.length)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} câu
                  </option>
                ))}
              <option value={cards.length}>Tất cả ({cards.length} câu)</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleNewFullTest}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tạo đề mới
          </button>
        </div>
      </div>

      {/* Results Summary Banner */}
      {submitted && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-500">Kết quả bài kiểm tra</p>
              <div className="flex items-baseline gap-3 tabular-nums">
                <span className="text-3xl font-bold text-slate-900">
                  {scoreSummary.pct}%
                </span>
                <span className="text-sm font-semibold text-emerald-700">
                  Đúng {scoreSummary.correct}/{scoreSummary.total} câu
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {scoreSummary.missedVocabs.length === 0
                  ? 'Xuất sắc! Toàn bộ từ vựng trong đề đã được đánh dấu Đã thuộc.'
                  : `${scoreSummary.missedVocabs.length} từ làm sai đã được lưu vào Cần ôn lại.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {scoreSummary.missedVocabs.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleRetakeMissed}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
                  >
                    Làm lại các câu sai ({scoreSummary.missedVocabs.length})
                  </button>
                  <button
                    type="button"
                    onClick={onReviewMissedWithCards}
                    className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
                  >
                    Ôn bằng Thẻ ghi nhớ
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleNewFullTest}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
              >
                Làm đề mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Option Meaning Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const chosenVocabId = selectedAnswers[q.id] ?? '';
          const isRight = submitted && chosenVocabId === q.vocab.id;
          const isWrong = submitted && !isRight;
          const isStarred = starredIds.includes(q.vocab.id);

          return (
            <div
              key={q.id}
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    Câu {idx + 1} / {questions.length}
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h4 className="text-lg font-bold text-slate-900">{q.vocab.term}</h4>
                    {q.vocab.partOfSpeech && (
                      <span className="font-mono text-xs text-slate-500">
                        ({q.vocab.partOfSpeech})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakEnglish(q.vocab.term)}
                    title="Nghe phát âm"
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                  >
                    <Volume2 className="w-4 h-4" />
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
                    <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {q.options.map((opt) => {
                  const selected = chosenVocabId === opt.vocabId;
                  const optCorrect = submitted && opt.vocabId === q.vocab.id;
                  const optWrong = submitted && selected && opt.vocabId !== q.vocab.id;

                  return (
                    <button
                      key={opt.vocabId}
                      type="button"
                      disabled={submitted}
                      onClick={() =>
                        setSelectedAnswers((prev) => ({ ...prev, [q.id]: opt.vocabId }))
                      }
                      className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        optCorrect
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                          : optWrong
                          ? 'bg-red-50 border-red-400 text-red-900'
                          : selected
                          ? 'bg-blue-50 border-blue-600 text-blue-900 font-medium'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span>{opt.vietnamese}</span>
                      {optCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {optWrong && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div className="text-xs text-slate-600 pt-1">
                  {isWrong && (
                    <span className="font-semibold text-red-700 mr-2">
                      Đáp án đúng: {q.vocab.vietnamese} ·
                    </span>
                  )}
                  <span>{q.vocab.definition}</span>
                  <span className="text-slate-400"> — &ldquo;{q.vocab.example}&rdquo;</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Bar */}
      {!submitted && questions.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-600 tabular-nums">
            Đã chọn {scoreSummary.answered} / {scoreSummary.total} câu
          </span>
          <button
            type="button"
            onClick={handleSubmitTest}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
          >
            Nộp bài kiểm tra
          </button>
        </div>
      )}
    </div>
  );
};

/* ---------------------- 1. FLASHCARDS MODE ---------------------- */
const FlashcardsMode: React.FC<{
  cards: VocabEntry[];
  vocabMastery: Record<string, VocabMasteryStatus>;
  starredIds: string[];
  onSetMastery: (id: string, status: VocabMasteryStatus) => void;
  onToggleStar: (id: string) => void;
}> = ({ cards, vocabMastery, starredIds, onSetMastery, onToggleStar }) => {
  const [deck, setDeck] = useState<VocabEntry[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reverseOrder, setReverseOrder] = useState(false);

  useEffect(() => {
    setDeck(cards);
    setIndex(0);
    setFlipped(false);
  }, [cards]);

  const currentCard = deck[Math.min(index, Math.max(0, deck.length - 1))];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.code === 'ArrowRight') {
        setFlipped(false);
        setIndex((i) => (i + 1 < deck.length ? i + 1 : 0));
      } else if (e.code === 'ArrowLeft') {
        setFlipped(false);
        setIndex((i) => (i - 1 >= 0 ? i - 1 : deck.length - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deck.length]);

  if (!currentCard) return null;

  const isStarred = starredIds.includes(currentCard.id);
  const mastery = vocabMastery[currentCard.id] ?? 'new';

  const handleShuffle = () => {
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setDeck(copy);
    setIndex(0);
    setFlipped(false);
  };

  const goNext = () => {
    setFlipped(false);
    setIndex((i) => (i + 1 < deck.length ? i + 1 : 0));
  };

  const goPrev = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 >= 0 ? i - 1 : deck.length - 1));
  };

  const frontMain = reverseOrder ? currentCard.vietnamese : currentCard.term;
  const frontSub = reverseOrder ? currentCard.definition : currentCard.partOfSpeech;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="tabular-nums font-medium text-slate-700">
          Thẻ {index + 1} / {deck.length} · Unit {currentCard.unitNumber}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setReverseOrder((r) => !r);
              setFlipped(false);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {reverseOrder ? 'Hiện nghĩa trước' : 'Hiện từ trước'}
          </button>
          <button
            type="button"
            onClick={handleShuffle}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Trộn
          </button>
        </div>
      </div>

      {/* Light, Calm 3D Flip Card */}
      <div
        className="perspective-1000 w-full cursor-pointer select-none"
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className={`relative w-full min-h-[260px] sm:min-h-[290px] transition-transform duration-500 preserve-3d ${
            flipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front Face */}
          <div className="absolute inset-0 backface-hidden bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400">
                {mastery === 'mastered' ? 'Đã thuộc' : mastery === 'learning' ? 'Đang ôn' : 'Mặt trước'}
              </span>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => speakEnglish(currentCard.term)}
                  title="Nghe phát âm"
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStar(currentCard.id)}
                  title="Gắn sao"
                  className={`p-2 rounded-lg border cursor-pointer ${
                    isStarred
                      ? 'bg-amber-50 border-amber-300 text-amber-500'
                      : 'border-slate-200 text-slate-400 hover:text-amber-500'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            </div>

            <div className="text-center my-auto py-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {frontMain}
              </h2>
              {frontSub && (
                <p className="text-sm text-slate-500 mt-1.5 font-mono">{frontSub}</p>
              )}
            </div>

            <div className="text-center text-xs text-slate-400">
              Nhấn thẻ (hoặc Space) để xem nghĩa
            </div>
          </div>

          {/* Back Face */}
          <div className="absolute inset-0 backface-hidden rotate-y-180 bg-blue-50/40 border border-blue-200 rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-600">
                {currentCard.term}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speakEnglish(`${currentCard.term}. ${currentCard.example}`);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Nghe ví dụ
              </button>
            </div>

            <div className="my-auto py-3 space-y-2.5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-blue-700">
                {currentCard.vietnamese}
              </p>
              <p className="text-sm text-slate-700 max-w-lg mx-auto">
                {currentCard.definition}
              </p>
              <p className="text-xs sm:text-sm italic text-slate-600 max-w-lg mx-auto pt-2 border-t border-blue-100">
                &ldquo;{currentCard.example}&rdquo;
              </p>
            </div>

            <div className="text-center text-xs text-slate-400">
              Nhấn thẻ để quay lại
            </div>
          </div>
        </div>
      </div>

      {/* Simple Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Trước
          </button>
          <button
            type="button"
            onClick={goNext}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
          >
            Sau
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSetMastery(currentCard.id, 'learning');
              goNext();
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
          >
            Cần ôn lại
          </button>
          <button
            type="button"
            onClick={() => {
              onSetMastery(currentCard.id, 'mastered');
              goNext();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Đã thuộc
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------------- 2. LEARN MODE ---------------------- */
const LearnMode: React.FC<{
  cards: VocabEntry[];
  distractorPool: VocabEntry[];
  onSetMastery: (id: string, status: VocabMasteryStatus) => void;
}> = ({ cards, distractorPool, onSetMastery }) => {
  const [queue, setQueue] = useState<VocabEntry[]>(() => [...cards]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [masteredInSession, setMasteredInSession] = useState<number>(0);

  useEffect(() => {
    setQueue([...cards]);
    setSelectedOption(null);
    setMasteredInSession(0);
  }, [cards]);

  const current = queue[0];

  const options = useMemo(() => {
    if (!current) return [];
    const others = distractorPool
      .filter((v) => v.id !== current.id && v.vietnamese !== current.vietnamese)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    return [current, ...others].sort(() => Math.random() - 0.5);
  }, [current, distractorPool]);

  if (!current) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <Trophy className="w-9 h-9 text-emerald-600 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Đã học xong tất cả từ!</h3>
        <button
          type="button"
          onClick={() => {
            setQueue([...cards]);
            setSelectedOption(null);
            setMasteredInSession(0);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Học lại từ đầu
        </button>
      </div>
    );
  }

  const handleChoose = (chosenId: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(chosenId);
    onSetMastery(current.id, chosenId === current.id ? 'mastered' : 'learning');
  };

  const handleNext = () => {
    const isCorrect = selectedOption === current.id;
    const rest = queue.slice(1);
    if (isCorrect) {
      setMasteredInSession((n) => n + 1);
      setQueue(rest);
    } else {
      const insertAt = Math.min(rest.length, 2);
      setQueue([...rest.slice(0, insertAt), current, ...rest.slice(insertAt)]);
    }
    setSelectedOption(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
        <span>Còn lại: {queue.length} từ</span>
        <span>Đã xong: {masteredInSession}/{cards.length}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">{current.term}</h3>
          <p className="text-sm text-slate-600 mt-1">{current.definition}</p>
        </div>
        <button
          type="button"
          onClick={() => speakEnglish(current.term)}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer shrink-0"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((opt) => {
          const isSelected = selectedOption === opt.id;
          const isCorrectOpt = opt.id === current.id;
          const showResult = selectedOption !== null;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleChoose(opt.id)}
              disabled={showResult}
              className={`text-left p-3.5 rounded-lg border text-sm transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                showResult && isCorrectOpt
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold'
                  : showResult && isSelected && !isCorrectOpt
                  ? 'bg-red-50 border-red-400 text-red-900'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
              }`}
            >
              <span>{opt.vietnamese}</span>
              {showResult && isCorrectOpt && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {showResult && isSelected && !isCorrectOpt && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
            </button>
          );
        })}
      </div>

      {selectedOption !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-sm text-slate-700">
            {selectedOption === current.id ? (
              <span className="font-semibold text-emerald-700">
                Đúng! Ví dụ: &ldquo;{current.example}&rdquo;
              </span>
            ) : (
              <span className="font-semibold text-red-700">
                Chưa đúng — Đáp án: {current.vietnamese} (sẽ hỏi lại sau)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
          >
            Tiếp tục
          </button>
        </div>
      )}
    </div>
  );
};

/* ---------------------- 3. MATCH MODE ---------------------- */
interface MatchTile {
  uid: string;
  vocabId: string;
  side: 'term' | 'meaning';
  text: string;
}

const MatchMode: React.FC<{
  scopeKey: string;
  cards: VocabEntry[];
  bestTimeMs?: number;
  onUpdateBest: (scopeKey: string, timeMs: number) => void;
}> = ({ scopeKey, cards, bestTimeMs, onUpdateBest }) => {
  const buildRound = (source: VocabEntry[]) => {
    const picked = [...source].sort(() => Math.random() - 0.5).slice(0, 6);
    const tiles: MatchTile[] = [];
    for (const v of picked) {
      tiles.push({ uid: `${v.id}-t`, vocabId: v.id, side: 'term', text: v.term });
      tiles.push({ uid: `${v.id}-m`, vocabId: v.id, side: 'meaning', text: v.vietnamese });
    }
    return tiles.sort(() => Math.random() - 0.5);
  };

  const [tiles, setTiles] = useState<MatchTile[]>(() => buildRound(cards));
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [selectedTile, setSelectedTile] = useState<MatchTile | null>(null);
  const [wrongPair, setWrongPair] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [finishedMs, setFinishedMs] = useState<number | null>(null);

  useEffect(() => {
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  useEffect(() => {
    if (!startedAt || finishedMs !== null) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, finishedMs]);

  const resetGame = () => {
    setTiles(buildRound(cards));
    setMatchedIds([]);
    setSelectedTile(null);
    setWrongPair([]);
    setStartedAt(null);
    setElapsedMs(0);
    setFinishedMs(null);
  };

  const handleTileClick = (tile: MatchTile) => {
    if (matchedIds.includes(tile.vocabId) || wrongPair.length > 0 || finishedMs !== null) return;
    const now = Date.now();
    const effectiveStart = startedAt ?? now;
    if (!startedAt) setStartedAt(now);

    if (!selectedTile) {
      setSelectedTile(tile);
      return;
    }

    if (selectedTile.uid === tile.uid) {
      setSelectedTile(null);
      return;
    }

    if (selectedTile.vocabId === tile.vocabId && selectedTile.side !== tile.side) {
      const nextMatched = [...matchedIds, tile.vocabId];
      setMatchedIds(nextMatched);
      setSelectedTile(null);
      if (nextMatched.length === tiles.length / 2) {
        const finalTime = Date.now() - effectiveStart;
        setFinishedMs(finalTime);
        setElapsedMs(finalTime);
        onUpdateBest(scopeKey, finalTime);
      }
    } else {
      setWrongPair([selectedTile.uid, tile.uid]);
      setSelectedTile(null);
      window.setTimeout(() => setWrongPair([]), 450);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Chọn 1 từ tiếng Anh và nghĩa tiếng Việt tương ứng.</p>
        <div className="flex items-center gap-4 tabular-nums text-sm">
          <span className="font-mono font-bold text-blue-600">
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
          {bestTimeMs && (
            <span className="text-xs text-slate-500">
              Kỷ lục: {(bestTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          <button
            type="button"
            onClick={resetGame}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Chơi lại
          </button>
        </div>
      </div>

      {finishedMs !== null ? (
        <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
          <Trophy className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-base font-bold text-emerald-900">
            Hoàn thành trong {(finishedMs / 1000).toFixed(2)} giây!
          </p>
          <button
            type="button"
            onClick={resetGame}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold cursor-pointer"
          >
            Ván mới
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {tiles.map((tile) => {
            const isMatched = matchedIds.includes(tile.vocabId);
            const isSelected = selectedTile?.uid === tile.uid;
            const isWrong = wrongPair.includes(tile.uid);

            return (
              <button
                key={tile.uid}
                type="button"
                disabled={isMatched}
                onClick={() => handleTileClick(tile)}
                className={`min-h-[80px] p-3 rounded-lg border text-center flex items-center justify-center text-sm transition-colors cursor-pointer ${
                  isMatched
                    ? 'opacity-20 bg-emerald-50 border-emerald-200 cursor-default'
                    : isWrong
                    ? 'bg-red-50 border-red-400 text-red-900'
                    : isSelected
                    ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <span className={tile.side === 'term' ? 'font-semibold' : ''}>
                  {tile.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------------- 4. WRITE MODE ---------------------- */
const WriteMode: React.FC<{
  cards: VocabEntry[];
  onSetMastery: (id: string, status: VocabMasteryStatus) => void;
}> = ({ cards, onSetMastery }) => {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState<'correct' | 'wrong' | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setIndex(0);
    setInput('');
    setSubmitted(null);
    setShowHint(false);
  }, [cards]);

  const current = cards[index % cards.length];
  if (!current) return null;

  const cleanTarget = current.term.replace(/\s*\(.*?\)\s*/g, '').trim();

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const isOk =
      normalizeAnswer(input) === normalizeAnswer(current.term) ||
      normalizeAnswer(input) === normalizeAnswer(cleanTarget);
    setSubmitted(isOk ? 'correct' : 'wrong');
    onSetMastery(current.id, isOk ? 'mastered' : 'learning');
  };

  const handleNext = () => {
    setIndex((i) => (i + 1) % cards.length);
    setInput('');
    setSubmitted(null);
    setShowHint(false);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
        <span>Từ {index + 1} / {cards.length}</span>
        <button
          type="button"
          onClick={() => speakEnglish(current.term)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
        >
          <Volume2 className="w-3.5 h-3.5" />
          Nghe từ
        </button>
      </div>

      <div>
        <h3 className="text-xl font-bold text-slate-900">{current.vietnamese}</h3>
        <p className="text-sm text-slate-600 mt-1">{current.definition}</p>
        {showHint && (
          <p className="text-xs font-mono text-amber-700 mt-2">
            Gợi ý: {cleanTarget.slice(0, 2)}... ({cleanTarget.length} ký tự)
          </p>
        )}
      </div>

      <form onSubmit={handleCheck} className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (submitted) setSubmitted(null);
          }}
          placeholder="Gõ từ tiếng Anh..."
          className="w-full px-3.5 py-2.5 text-base rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer"
            >
              Kiểm tra
            </button>
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Gợi ý
            </button>
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium cursor-pointer"
          >
            Từ tiếp theo
          </button>
        </div>
      </form>

      {submitted && (
        <div
          className={`p-3.5 rounded-lg border text-sm ${
            submitted === 'correct'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {submitted === 'correct' ? (
            <span className="font-semibold">Chính xác! ({current.term})</span>
          ) : (
            <span>
              Chưa khớp. Đáp án đúng: <strong>{current.term}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
