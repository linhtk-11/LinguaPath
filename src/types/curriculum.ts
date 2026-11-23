export type UnitType = 'grammar' | 'vocabulary';

export type VocabCategory =
  | 'topic_vocab'
  | 'phrasal_verb'
  | 'prepositional_phrase'
  | 'word_formation'
  | 'word_pattern';

export interface VocabEntry {
  id: string;
  unitNumber: number;
  unitTitle: string;
  category: VocabCategory;
  term: string;
  partOfSpeech?: string;
  definition: string;
  vietnamese: string;
  example: string;
  derivatives?: string[];
}

export interface GrammarFormRow {
  label: string;
  statement: string;
  negative: string;
  question: string;
}

export interface GrammarUseRow {
  use: string;
  example: string;
}

export interface GrammarSection {
  heading: string;
  formSummary?: string;
  forms?: GrammarFormRow[];
  uses: GrammarUseRow[];
  helpfulHints?: string[];
  watchOut?: string[];
}

export type ExerciseKind = 'fill' | 'choice' | 'transform' | 'error_fix' | 'match';

export interface ExerciseItem {
  id: string;
  number: number | string;
  prompt: string;
  keyword?: string;
  options?: string[];
  /** Multiple acceptable answers separated by | */
  answer: string;
  explanation?: string;
}

export interface ExerciseBlock {
  id: string;
  label: string;
  title: string;
  kind: ExerciseKind;
  wordBank?: string[];
  contextPassage?: string;
  items: ExerciseItem[];
}

export interface StudyUnit {
  id: string;
  unitNumber: number;
  title: string;
  topic: string;
  type: UnitType;
  estimatedMinutes: number;
  pageRange?: string;
  summaryVi: string;
  grammarSections?: GrammarSection[];
  vocabItems?: VocabEntry[];
  exercises: ExerciseBlock[];
}

export interface ReviewTest {
  id: string;
  reviewNumber: number;
  title: string;
  coveredUnits: number[];
  exercises: ExerciseBlock[];
}

export interface IrregularVerbEntry {
  bare: string;
  pastSimple: string;
  pastParticiple: string;
  vietnamese: string;
}

export interface CourseDocument {
  id: string;
  title: string;
  subtitle: string;
  level: string;
  sourceFileName?: string;
  sourcePdfPath?: string;
  defaultDays: number;
  units: StudyUnit[];
  reviews?: ReviewTest[];
  irregularVerbs?: IrregularVerbEntry[];
  createdAt: string;
}

export interface StudyPlanDay {
  dayNumber: number;
  title: string;
  focusLabel: string;
  units: StudyUnit[];
  reviewCheckpoint?: ReviewTest;
  vocabPool: VocabEntry[];
  estimatedMinutes: number;
}

export type VocabMasteryStatus = 'new' | 'learning' | 'mastered';

export interface DayQuizResult {
  score: number;
  total: number;
  completedAt: string;
  missedIds: string[];
}

export interface ExerciseSavedState {
  answers: Record<string, string>;
  checked: boolean;
  correctCount: number;
  totalCount: number;
}

export interface UserProgressState {
  selectedDaysByCourse: Record<string, number>;
  completedDaysByCourse: Record<string, number[]>;
  exerciseState: Record<string, ExerciseSavedState>;
  vocabMastery: Record<string, VocabMasteryStatus>;
  starredVocabIds: string[];
  dayQuizResults: Record<string, DayQuizResult>;
  matchBestTimeMs: Record<string, number>;
}
