import { CourseDocument } from '../../types/curriculum';
import { GRAMMAR_UNITS_1 } from './grammarUnits1';
import { GRAMMAR_UNITS_2 } from './grammarUnits2';
import { VOCAB_UNITS_1 } from './vocabUnits1';
import { VOCAB_UNITS_2 } from './vocabUnits2';
import { DESTINATION_B1_REVIEWS, IRREGULAR_VERBS } from './reviewsAndRef';

const ALL_UNITS = [
  ...GRAMMAR_UNITS_1,
  ...GRAMMAR_UNITS_2,
  ...VOCAB_UNITS_1,
  ...VOCAB_UNITS_2,
].sort((a, b) => a.unitNumber - b.unitNumber);

export const DESTINATION_B1_COURSE: CourseDocument = {
  id: 'destination-b1',
  title: 'Destination B1: Grammar & Vocabulary',
  subtitle: '42 Units · 14 Reviews · Irregular Verbs Reference (Malcolm Mann & Steve Taylore-Knowles)',
  level: 'B1 Intermediate (CEFR)',
  sourceFileName: 'Destination_B1_.pdf',
  sourcePdfPath: '/assets/aistudio/Destination_B1__70edf106.pdf',
  defaultDays: 14,
  units: ALL_UNITS,
  reviews: DESTINATION_B1_REVIEWS,
  irregularVerbs: IRREGULAR_VERBS,
  createdAt: '2026-01-01T00:00:00.000Z',
};
