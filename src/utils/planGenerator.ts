import { CourseDocument, StudyPlanDay, StudyUnit, VocabEntry } from '../types/curriculum';

/**
 * Distributes 100% of a course's units evenly across `totalDays` (1..180)
 * so the learner covers every single unit and review checkpoint in their chosen timeframe.
 */
export function buildStudyPlan(course: CourseDocument, totalDays: number): StudyPlanDay[] {
  const safeDays = Math.max(1, Math.min(180, Math.round(totalDays)));
  const units = course.units;
  if (units.length === 0) return [];

  // Build fallback vocab items from unit exercises/grammar if a grammar-only day has few vocab entries
  const allCourseVocab: VocabEntry[] = units.flatMap((u) => u.vocabItems ?? []);

  const days: StudyPlanDay[] = [];
  const totalUnits = units.length;

  if (safeDays <= totalUnits) {
    // Distribute all units across `safeDays` days cleanly (consecutive slices)
    let cursor = 0;
    for (let d = 1; d <= safeDays; d++) {
      const remainingUnits = totalUnits - cursor;
      const remainingDays = safeDays - d + 1;
      const count = Math.ceil(remainingUnits / remainingDays);
      const dayUnits = units.slice(cursor, cursor + count);
      cursor += count;

      const unitNumbers = dayUnits.map((u) => u.unitNumber);
      const matchingReview = course.reviews?.find((rev) =>
        rev.coveredUnits.every((num) => num <= unitNumbers[unitNumbers.length - 1]) &&
        rev.coveredUnits.some((num) => unitNumbers.includes(num))
      );

      const directVocab = dayUnits.flatMap((u) => u.vocabItems ?? []);
      // Ensure every day has a vocab quiz & Quizlet practice pool (if a day only has Grammar units, include nearest upcoming/preceding vocab unit terms)
      const vocabPool = directVocab.length > 0
        ? directVocab
        : findNearestVocabPool(units, dayUnits[0].unitNumber, allCourseVocab);

      const estimatedMinutes = dayUnits.reduce((acc, u) => acc + u.estimatedMinutes, 0) + (matchingReview ? 15 : 10);

      days.push({
        dayNumber: d,
        title: formatDayTitle(dayUnits),
        focusLabel: formatFocusLabel(dayUnits, matchingReview?.title),
        units: dayUnits,
        reviewCheckpoint: matchingReview,
        vocabPool,
        estimatedMinutes,
      });
    }
  } else {
    // More days than units: assign 1 unit per study slot and insert dedicated Review & Quizlet Mastery consolidation days
    const stepRatio = safeDays / totalUnits;
    const daySlots: { units: StudyUnit[]; isConsolidation: boolean }[] = Array.from(
      { length: safeDays },
      () => ({ units: [], isConsolidation: false })
    );

    units.forEach((unit, idx) => {
      const targetDayIdx = Math.min(safeDays - 1, Math.floor(idx * stepRatio));
      daySlots[targetDayIdx].units.push(unit);
    });

    for (let i = 0; i < safeDays; i++) {
      const slot = daySlots[i];
      if (slot.units.length > 0) {
        const unitNumbers = slot.units.map((u) => u.unitNumber);
        const matchingReview = course.reviews?.find((rev) =>
          rev.coveredUnits.some((num) => unitNumbers.includes(num)) &&
          rev.coveredUnits[rev.coveredUnits.length - 1] === unitNumbers[unitNumbers.length - 1]
        );
        const directVocab = slot.units.flatMap((u) => u.vocabItems ?? []);
        const vocabPool = directVocab.length > 0
          ? directVocab
          : findNearestVocabPool(units, slot.units[0].unitNumber, allCourseVocab);

        days.push({
          dayNumber: i + 1,
          title: formatDayTitle(slot.units),
          focusLabel: formatFocusLabel(slot.units, matchingReview?.title),
          units: slot.units,
          reviewCheckpoint: matchingReview,
          vocabPool,
          estimatedMinutes: slot.units.reduce((a, u) => a + u.estimatedMinutes, 0) + 10,
        });
      } else {
        // Consolidation & Active Recall day based on the most recent units
        const prevUnits = days.slice(-2).flatMap((d) => d.units);
        const uniqueRecent = Array.from(new Map(prevUnits.map((u) => [u.id, u])).values());
        const recentVocab = uniqueRecent.flatMap((u) => u.vocabItems ?? []);
        const pool = recentVocab.length > 0
          ? recentVocab
          : allCourseVocab.slice(0, 15);
        const matchingReview = course.reviews?.find((rev) =>
          uniqueRecent.some((u) => rev.coveredUnits.includes(u.unitNumber))
        );

        days.push({
          dayNumber: i + 1,
          title: `Ôn tập & Củng cố (Ngày ${i + 1})`,
          focusLabel: matchingReview
            ? `${matchingReview.title} · Flashcards & Quizlet Recall`
            : 'Active Recall · Flashcards & Vocabulary Mastery',
          units: [],
          reviewCheckpoint: matchingReview,
          vocabPool: pool,
          estimatedMinutes: 25,
        });
      }
    }
  }

  return days;
}

function findNearestVocabPool(
  units: StudyUnit[],
  unitNumber: number,
  fallbackAll: VocabEntry[]
): VocabEntry[] {
  const vocabUnits = units.filter((u) => (u.vocabItems?.length ?? 0) > 0);
  if (vocabUnits.length === 0) return fallbackAll;
  let closest = vocabUnits[0];
  let bestDist = Math.abs(closest.unitNumber - unitNumber);
  for (const vu of vocabUnits) {
    const dist = Math.abs(vu.unitNumber - unitNumber);
    if (dist < bestDist) {
      closest = vu;
      bestDist = dist;
    }
  }
  return closest.vocabItems ?? fallbackAll.slice(0, 20);
}

function formatDayTitle(units: StudyUnit[]): string {
  if (units.length === 0) return 'Ôn tập tổng hợp';
  if (units.length === 1) {
    return `Unit ${units[0].unitNumber}: ${units[0].topic}`;
  }
  const first = units[0].unitNumber;
  const last = units[units.length - 1].unitNumber;
  return `Units ${first}–${last}: ${units.map((u) => u.topic).slice(0, 2).join(' & ')}${units.length > 2 ? '…' : ''}`;
}

function formatFocusLabel(units: StudyUnit[], reviewTitle?: string): string {
  const gCount = units.filter((u) => u.type === 'grammar').length;
  const vCount = units.filter((u) => u.type === 'vocabulary').length;
  const parts: string[] = [];
  if (gCount > 0) parts.push(`${gCount} Grammar`);
  if (vCount > 0) parts.push(`${vCount} Vocabulary`);
  if (reviewTitle) parts.push(reviewTitle);
  return parts.join(' · ');
}

export function normalizeAnswer(val: string): string {
  return val
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
}

export function checkUserAnswer(userInput: string, acceptedRaw: string): boolean {
  const normUser = normalizeAnswer(userInput);
  if (!normUser) return false;
  const variants = acceptedRaw.split('|').map((v) => normalizeAnswer(v));
  return variants.includes(normUser);
}
