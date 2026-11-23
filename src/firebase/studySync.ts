import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  CourseDocument,
  DayQuizResult,
  ExerciseSavedState,
  StudyUnit,
  UserProgressState,
  VocabMasteryStatus,
} from '../types/curriculum';
import { db, handleFirestoreError, OperationType } from './client';

export interface CloudCourseProgressDoc {
  ownerId: string;
  courseId: string;
  selectedDays: number;
  completedDays: number[];
  exerciseState: Record<string, ExerciseSavedState>;
  vocabMastery: Record<string, VocabMasteryStatus>;
  starredVocabIds: string[];
  dayQuizResults: Record<string, DayQuizResult>;
  matchBestTimeMs: Record<string, number>;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function clampDays(days: number): number {
  const n = Math.round(Number(days) || 14);
  return Math.max(1, Math.min(180, n));
}

function sanitizeSafeId(raw: string, fallback = 'destination-b1'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : fallback;
}

function belongsToCourse(keyOrId: string, courseId: string): boolean {
  if (courseId === 'destination-b1') {
    return !keyOrId.startsWith('custom-');
  }
  return keyOrId.startsWith(`${courseId}-`);
}

function filterRecordForCourse<T>(
  record: Record<string, T>,
  courseId: string,
  maxEntries: number
): Record<string, T> {
  const entries = Object.entries(record).filter(([k]) => belongsToCourse(k, courseId));
  return Object.fromEntries(entries.slice(0, maxEntries));
}

export async function ensureUserProfile(
  user: User,
  fallbackActiveCourseId: string
): Promise<{ activeCourseId: string }> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const safeCourseId = sanitizeSafeId(fallbackActiveCourseId);
  const displayName = (user.displayName || user.email || 'Learner').trim().slice(0, 120) || 'Learner';
  const photoURL = user.photoURL && user.photoURL.length <= 500 ? user.photoURL : undefined;

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!snap.exists()) {
    const payload: Record<string, unknown> = {
      ownerId: user.uid,
      displayName,
      activeCourseId: safeCourseId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      payload.photoURL = photoURL;
    }
    try {
      await setDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
    return { activeCourseId: safeCourseId };
  }

  const existing = snap.data();
  const cloudActiveCourseId =
    typeof existing?.activeCourseId === 'string' && existing.activeCourseId.length > 0
      ? existing.activeCourseId
      : safeCourseId;

  const updates: Record<string, unknown> = {};
  if (existing?.displayName !== displayName) {
    updates.displayName = displayName;
  }
  if (photoURL && existing?.photoURL !== photoURL) {
    updates.photoURL = photoURL;
  }
  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
    try {
      await updateDoc(userRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  return { activeCourseId: cloudActiveCourseId };
}

export async function updateUserActiveCourse(
  uid: string,
  activeCourseId: string
): Promise<void> {
  const userPath = `users/${uid}`;
  const safeCourseId = sanitizeSafeId(activeCourseId);
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeCourseId: safeCourseId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function saveImportedCourseToCloud(
  uid: string,
  course: CourseDocument
): Promise<void> {
  const courseId = sanitizeSafeId(course.id, `custom-${Date.now()}`);
  const coursePath = `users/${uid}/courses/${courseId}`;
  const courseRef = doc(db, 'users', uid, 'courses', courseId);

  const sanitizedUnits: StudyUnit[] = stripUndefinedDeep(course.units || []).slice(0, 100);
  if (sanitizedUnits.length === 0) return;

  const title = (course.title || 'Khóa học tiếng Anh').trim().slice(0, 200) || 'Khóa học tiếng Anh';
  const subtitle = (course.subtitle || '').trim().slice(0, 500);
  const level = (course.level || 'B1').trim().slice(0, 80) || 'B1';
  const defaultDays = clampDays(course.defaultDays);
  const sourceFileName =
    course.sourceFileName && course.sourceFileName.trim().length > 0
      ? course.sourceFileName.trim().slice(0, 200)
      : undefined;

  let snap;
  try {
    snap = await getDoc(courseRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, coursePath);
  }

  if (!snap.exists()) {
    const createPayload: Record<string, unknown> = {
      ownerId: uid,
      id: courseId,
      title,
      subtitle,
      level,
      defaultDays,
      units: sanitizedUnits,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (sourceFileName) {
      createPayload.sourceFileName = sourceFileName;
    }
    try {
      await setDoc(courseRef, createPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, coursePath);
    }
  } else {
    try {
      await updateDoc(courseRef, {
        title,
        subtitle,
        level,
        defaultDays,
        units: sanitizedUnits,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, coursePath);
    }
  }
}

export async function deleteCourseFromCloud(uid: string, courseId: string): Promise<void> {
  const safeId = sanitizeSafeId(courseId);
  const coursePath = `users/${uid}/courses/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'courses', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, coursePath);
  }

  const progressPath = `users/${uid}/courseProgress/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'courseProgress', safeId));
  } catch {
    // Progress document might not exist yet; ignore
  }
  void progressPath;
}

export async function saveCourseProgressToCloud(
  uid: string,
  courseId: string,
  defaultDays: number,
  progress: UserProgressState
): Promise<void> {
  const safeId = sanitizeSafeId(courseId);
  const progressPath = `users/${uid}/courseProgress/${safeId}`;
  const progressRef = doc(db, 'users', uid, 'courseProgress', safeId);

  const selectedDays = clampDays(progress.selectedDaysByCourse[safeId] ?? defaultDays);
  const completedDays = (progress.completedDaysByCourse[safeId] ?? [])
    .map((d) => Math.round(Number(d)))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 180)
    .slice(0, 180);

  const exerciseState = stripUndefinedDeep(
    filterRecordForCourse(progress.exerciseState, safeId, 1000)
  );
  const vocabMastery = stripUndefinedDeep(
    filterRecordForCourse(progress.vocabMastery, safeId, 3000)
  );
  const starredVocabIds = (progress.starredVocabIds ?? [])
    .filter((id) => typeof id === 'string' && belongsToCourse(id, safeId))
    .slice(0, 2000);
  const dayQuizResults = stripUndefinedDeep(
    filterRecordForCourse(progress.dayQuizResults, safeId, 365)
  );
  const matchBestTimeMs = stripUndefinedDeep(
    filterRecordForCourse(progress.matchBestTimeMs, safeId, 500)
  );

  let snap;
  try {
    snap = await getDoc(progressRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, progressPath);
  }

  if (!snap.exists()) {
    try {
      await setDoc(progressRef, {
        ownerId: uid,
        courseId: safeId,
        selectedDays,
        completedDays,
        exerciseState,
        vocabMastery,
        starredVocabIds,
        dayQuizResults,
        matchBestTimeMs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, progressPath);
    }
  } else {
    try {
      await updateDoc(progressRef, {
        selectedDays,
        completedDays,
        exerciseState,
        vocabMastery,
        starredVocabIds,
        dayQuizResults,
        matchBestTimeMs,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, progressPath);
    }
  }
}

export async function migrateLocalDataToCloudIfNeeded(
  uid: string,
  localCustomCourses: CourseDocument[],
  localProgress: UserProgressState
): Promise<void> {
  const coursesPath = `users/${uid}/courses`;
  let existingCourseIds = new Set<string>();
  try {
    const q = query(collection(db, 'users', uid, 'courses'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    existingCourseIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, coursesPath);
  }

  for (const course of localCustomCourses) {
    if (!existingCourseIds.has(course.id)) {
      await saveImportedCourseToCloud(uid, course);
    }
  }

  const progressPath = `users/${uid}/courseProgress`;
  let existingProgressIds = new Set<string>();
  try {
    const q = query(collection(db, 'users', uid, 'courseProgress'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    existingProgressIds = new Set(snap.docs.map((d) => d.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, progressPath);
  }

  const hasLocalDestProgress =
    (localProgress.completedDaysByCourse['destination-b1']?.length ?? 0) > 0 ||
    Object.keys(localProgress.exerciseState).some((k) => belongsToCourse(k, 'destination-b1')) ||
    Object.keys(localProgress.vocabMastery).some((k) => belongsToCourse(k, 'destination-b1')) ||
    Object.keys(localProgress.dayQuizResults).some((k) => belongsToCourse(k, 'destination-b1')) ||
    localProgress.starredVocabIds.some((k) => belongsToCourse(k, 'destination-b1')) ||
    (localProgress.selectedDaysByCourse['destination-b1'] ?? 14) !== 14;

  if (!existingProgressIds.has('destination-b1') && hasLocalDestProgress) {
    await saveCourseProgressToCloud(uid, 'destination-b1', 14, localProgress);
  }

  for (const course of localCustomCourses) {
    if (!existingProgressIds.has(course.id)) {
      await saveCourseProgressToCloud(uid, course.id, course.defaultDays, localProgress);
    }
  }
}

export function subscribeToCloudCourses(
  uid: string,
  onCourses: (courses: CourseDocument[]) => void
): Unsubscribe {
  const path = `users/${uid}/courses`;
  const q = query(collection(db, 'users', uid, 'courses'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CourseDocument[] = snapshot.docs.map((d) => {
        const data = d.data();
        const createdAtVal =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString();
        return {
          id: String(data.id || d.id),
          title: String(data.title || 'Khóa học'),
          subtitle: String(data.subtitle || ''),
          level: String(data.level || 'B1'),
          sourceFileName:
            typeof data.sourceFileName === 'string' ? data.sourceFileName : undefined,
          defaultDays: Number(data.defaultDays) || 14,
          units: Array.isArray(data.units) ? (data.units as StudyUnit[]) : [],
          createdAt: createdAtVal,
        };
      });
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onCourses(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToCloudProgress(
  uid: string,
  onProgress: (docs: CloudCourseProgressDoc[]) => void
): Unsubscribe {
  const path = `users/${uid}/courseProgress`;
  const q = query(collection(db, 'users', uid, 'courseProgress'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: CloudCourseProgressDoc[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ownerId: String(data.ownerId || uid),
          courseId: String(data.courseId || d.id),
          selectedDays: Number(data.selectedDays) || 14,
          completedDays: Array.isArray(data.completedDays)
            ? data.completedDays.map(Number)
            : [],
          exerciseState: (data.exerciseState as Record<string, ExerciseSavedState>) || {},
          vocabMastery: (data.vocabMastery as Record<string, VocabMasteryStatus>) || {},
          starredVocabIds: Array.isArray(data.starredVocabIds)
            ? data.starredVocabIds.map(String)
            : [],
          dayQuizResults: (data.dayQuizResults as Record<string, DayQuizResult>) || {},
          matchBestTimeMs: (data.matchBestTimeMs as Record<string, number>) || {},
        };
      });
      onProgress(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function mergeCloudProgressDocs(
  base: UserProgressState,
  cloudDocs: CloudCourseProgressDoc[]
): UserProgressState {
  if (cloudDocs.length === 0) return base;

  const selectedDaysByCourse = { ...base.selectedDaysByCourse };
  const completedDaysByCourse = { ...base.completedDaysByCourse };
  let exerciseState = { ...base.exerciseState };
  let vocabMastery = { ...base.vocabMastery };
  const starredSet = new Set<string>(base.starredVocabIds);
  let dayQuizResults = { ...base.dayQuizResults };
  let matchBestTimeMs = { ...base.matchBestTimeMs };

  for (const docItem of cloudDocs) {
    selectedDaysByCourse[docItem.courseId] = docItem.selectedDays;
    completedDaysByCourse[docItem.courseId] = docItem.completedDays;
    exerciseState = { ...exerciseState, ...docItem.exerciseState };
    vocabMastery = { ...vocabMastery, ...docItem.vocabMastery };
    for (const id of docItem.starredVocabIds) {
      starredSet.add(id);
    }
    dayQuizResults = { ...dayQuizResults, ...docItem.dayQuizResults };
    matchBestTimeMs = { ...matchBestTimeMs, ...docItem.matchBestTimeMs };
  }

  return {
    selectedDaysByCourse,
    completedDaysByCourse,
    exerciseState,
    vocabMastery,
    starredVocabIds: Array.from(starredSet),
    dayQuizResults,
    matchBestTimeMs,
  };
}
