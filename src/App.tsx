import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { DESTINATION_B1_COURSE } from './data/destinationB1';
import {
  CourseDocument,
  DayQuizResult,
  ExerciseSavedState,
  StudyPlanDay,
  UserProgressState,
  VocabEntry,
  VocabMasteryStatus,
} from './types/curriculum';
import { buildStudyPlan } from './utils/planGenerator';
import { StudyPlanView } from './components/StudyPlanView';
import { LessonWorkspace } from './components/LessonWorkspace';
import { QuizletStudio } from './components/QuizletStudio';
import { ReferenceVault } from './components/ReferenceVault';
import { ImportDocumentModal } from './components/ImportDocumentModal';
import { auth, googleProvider } from './firebase/client';
import {
  deleteCourseFromCloud,
  ensureUserProfile,
  mergeCloudProgressDocs,
  migrateLocalDataToCloudIfNeeded,
  saveCourseProgressToCloud,
  saveImportedCourseToCloud,
  subscribeToCloudCourses,
  subscribeToCloudProgress,
  updateUserActiveCourse,
} from './firebase/studySync';

type NavTab = 'plan' | 'lesson' | 'quizlet' | 'vault';
type SyncState = 'local' | 'connecting' | 'saving' | 'synced' | 'error';

const STORAGE_CUSTOM_COURSES = 'lexiplan_custom_courses_v1';
const STORAGE_ACTIVE_COURSE = 'lexiplan_active_course_v1';
const STORAGE_PROGRESS = 'lexiplan_progress_v1';

const DEFAULT_PROGRESS: UserProgressState = {
  selectedDaysByCourse: { 'destination-b1': 14 },
  completedDaysByCourse: {},
  exerciseState: {},
  vocabMastery: {},
  starredVocabIds: [],
  dayQuizResults: {},
  matchBestTimeMs: {},
};

function loadCustomCourses(): CourseDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_COURSES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadProgress(): UserProgressState {
  try {
    const raw = localStorage.getItem(STORAGE_PROGRESS);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROGRESS, ...parsed };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function computeCourseProgressSignature(
  progress: UserProgressState,
  courseId: string,
  defaultDays: number
): string {
  const prefixMatch = (k: string) =>
    courseId === 'destination-b1' ? !k.startsWith('custom-') : k.startsWith(`${courseId}-`);

  const pickEntries = <T,>(rec: Record<string, T>) =>
    Object.entries(rec)
      .filter(([k]) => prefixMatch(k))
      .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify({
    selectedDays: progress.selectedDaysByCourse[courseId] ?? defaultDays,
    completedDays: progress.completedDaysByCourse[courseId] ?? [],
    exerciseState: pickEntries(progress.exerciseState),
    vocabMastery: pickEntries(progress.vocabMastery),
    starredVocabIds: progress.starredVocabIds.filter(prefixMatch).slice().sort(),
    dayQuizResults: pickEntries(progress.dayQuizResults),
    matchBestTimeMs: pickEntries(progress.matchBestTimeMs),
  });
}

export default function App() {
  const [customCourses, setCustomCourses] = useState<CourseDocument[]>(loadCustomCourses);
  const [activeCourseId, setActiveCourseId] = useState<string>(
    () => localStorage.getItem(STORAGE_ACTIVE_COURSE) || DESTINATION_B1_COURSE.id
  );
  const [progress, setProgress] = useState<UserProgressState>(loadProgress);
  const [activeTab, setActiveTab] = useState<NavTab>('plan');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(1);
  const [quizletScope, setQuizletScope] = useState<string>('day-1');
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const [authReady, setAuthReady] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cloudReady, setCloudReady] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const [authMessage, setAuthMessage] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [syncRetryNonce, setSyncRetryNonce] = useState<number>(0);

  const customCoursesRef = useRef(customCourses);
  customCoursesRef.current = customCourses;
  const activeCourseIdRef = useRef(activeCourseId);
  activeCourseIdRef.current = activeCourseId;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const lastSyncedSignaturesRef = useRef<Record<string, string>>({});

  const courses = useMemo(
    () => [DESTINATION_B1_COURSE, ...customCourses],
    [customCourses]
  );

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === activeCourseId) ?? DESTINATION_B1_COURSE,
    [courses, activeCourseId]
  );

  const selectedDays =
    progress.selectedDaysByCourse[activeCourse.id] ?? activeCourse.defaultDays;

  const planDays = useMemo(
    () => buildStudyPlan(activeCourse, selectedDays),
    [activeCourse, selectedDays]
  );

  const completedDays = progress.completedDaysByCourse[activeCourse.id] ?? [];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_COURSES, JSON.stringify(customCourses));
    } catch {
      // Ignore storage quota errors
    }
  }, [customCourses]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_COURSE, activeCourseId);
    } catch {
      // Ignore storage errors
    }
  }, [activeCourseId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(progress));
    } catch {
      // Ignore storage errors
    }
  }, [progress]);

  useEffect(() => {
    if (planDays.length > 0 && selectedDayNumber > planDays.length) {
      setSelectedDayNumber(1);
    }
  }, [planDays.length, selectedDayNumber]);

  // Firebase Auth & Firestore Cloud Sync lifecycle
  useEffect(() => {
    let unsubCourses: (() => void) | null = null;
    let unsubProgress: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubCourses) {
        unsubCourses();
        unsubCourses = null;
      }
      if (unsubProgress) {
        unsubProgress();
        unsubProgress = null;
      }

      setCurrentUser(user);
      setAuthReady(true);
      setAuthMessage('');

      if (!user) {
        setCloudReady(false);
        setSyncState('local');
        lastSyncedSignaturesRef.current = {};
        return;
      }

      if (!user.emailVerified) {
        setCloudReady(false);
        setSyncState('error');
        setAuthMessage('Tài khoản Google chưa xác minh email nên chưa thể đồng bộ Database.');
        return;
      }

      setSyncState('connecting');
      setCloudReady(false);

      try {
        const profileResult = await ensureUserProfile(user, activeCourseIdRef.current);
        if (cancelled) return;

        await migrateLocalDataToCloudIfNeeded(
          user.uid,
          customCoursesRef.current,
          progressRef.current
        );
        if (cancelled) return;

        if (profileResult.activeCourseId) {
          setActiveCourseId(profileResult.activeCourseId);
        }

        unsubCourses = subscribeToCloudCourses(user.uid, (cloudCourses) => {
          setCustomCourses(cloudCourses);
        });

        unsubProgress = subscribeToCloudProgress(user.uid, (cloudDocs) => {
          setProgress((prev) => {
            const merged = mergeCloudProgressDocs(prev, cloudDocs);
            for (const docItem of cloudDocs) {
              lastSyncedSignaturesRef.current[docItem.courseId] =
                computeCourseProgressSignature(
                  merged,
                  docItem.courseId,
                  docItem.selectedDays
                );
            }
            return merged;
          });
        });

        setCloudReady(true);
        setSyncState('synced');
      } catch (err) {
        if (cancelled) return;
        console.error('Cloud sync init error:', err);
        let detail = '';
        if (err instanceof Error) {
          try {
            const parsed = JSON.parse(err.message);
            if (parsed?.error) detail = ` (${parsed.error})`;
          } catch {
            detail = err.message ? ` (${err.message})` : '';
          }
        }
        setSyncState('error');
        setAuthMessage(
          `Không thể kết nối Cloud Database${detail}. Dữ liệu vẫn được lưu trên trình duyệt.`
        );
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubCourses) unsubCourses();
      if (unsubProgress) unsubProgress();
    };
  }, [syncRetryNonce]);

  // Debounced cloud progress save when user modifies progress for the active course
  useEffect(() => {
    if (!authReady || !currentUser || !currentUser.emailVerified || !cloudReady) {
      return;
    }

    const courseId = activeCourse.id;
    const currentSignature = computeCourseProgressSignature(
      progress,
      courseId,
      activeCourse.defaultDays
    );

    if (lastSyncedSignaturesRef.current[courseId] === currentSignature) {
      return;
    }

    setSyncState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await saveCourseProgressToCloud(
          currentUser.uid,
          courseId,
          activeCourse.defaultDays,
          progressRef.current
        );
        lastSyncedSignaturesRef.current[courseId] = computeCourseProgressSignature(
          progressRef.current,
          courseId,
          activeCourse.defaultDays
        );
        setSyncState('synced');
      } catch (err) {
        console.error('Save course progress failed:', err);
        setSyncState('error');
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [authReady, currentUser, cloudReady, progress, activeCourse.id, activeCourse.defaultDays]);

  const handleSignInGoogle = async () => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        setAuthMessage('Đăng nhập Google không thành công. Vui lòng thử lại.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    setAuthMessage('');
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSelectCourse = (courseId: string) => {
    setActiveCourseId(courseId);
    setSelectedDayNumber(1);
    setQuizletScope('all');
    if (cloudReady && currentUser?.emailVerified) {
      void updateUserActiveCourse(currentUser.uid, courseId).catch((err) =>
        console.error('Update active course failed:', err)
      );
    }
  };

  const handleCourseImported = (course: CourseDocument) => {
    setCustomCourses((prev) => [course, ...prev]);
    const nextProgress: UserProgressState = {
      ...progressRef.current,
      selectedDaysByCourse: {
        ...progressRef.current.selectedDaysByCourse,
        [course.id]: course.defaultDays,
      },
    };
    setProgress(nextProgress);
    setActiveCourseId(course.id);
    setSelectedDayNumber(1);
    setActiveTab('plan');

    if (cloudReady && currentUser?.emailVerified) {
      setSyncState('saving');
      void (async () => {
        try {
          await saveImportedCourseToCloud(currentUser.uid, course);
          await updateUserActiveCourse(currentUser.uid, course.id);
          await saveCourseProgressToCloud(
            currentUser.uid,
            course.id,
            course.defaultDays,
            nextProgress
          );
          lastSyncedSignaturesRef.current[course.id] = computeCourseProgressSignature(
            nextProgress,
            course.id,
            course.defaultDays
          );
          setSyncState('synced');
        } catch (err) {
          console.error('Save imported course failed:', err);
          setSyncState('error');
        }
      })();
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    setCustomCourses((prev) => prev.filter((c) => c.id !== courseId));
    const nextActive =
      activeCourseId === courseId ? DESTINATION_B1_COURSE.id : activeCourseId;
    if (activeCourseId === courseId) {
      setActiveCourseId(DESTINATION_B1_COURSE.id);
    }

    if (cloudReady && currentUser?.emailVerified) {
      void (async () => {
        try {
          await deleteCourseFromCloud(currentUser.uid, courseId);
          if (nextActive !== activeCourseId) {
            await updateUserActiveCourse(currentUser.uid, nextActive);
          }
        } catch (err) {
          console.error('Delete cloud course failed:', err);
        }
      })();
    }
  };

  const handleChangeDays = (days: number) => {
    setProgress((prev) => ({
      ...prev,
      selectedDaysByCourse: {
        ...prev.selectedDaysByCourse,
        [activeCourse.id]: days,
      },
    }));
  };

  const handleStartDay = (dayNumber: number) => {
    setSelectedDayNumber(dayNumber);
    setActiveTab('lesson');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveExerciseState = (blockId: string, state: ExerciseSavedState) => {
    setProgress((prev) => ({
      ...prev,
      exerciseState: {
        ...prev.exerciseState,
        [blockId]: state,
      },
    }));
  };

  const handleSetMastery = (vocabId: string, status: VocabMasteryStatus) => {
    setProgress((prev) => ({
      ...prev,
      vocabMastery: {
        ...prev.vocabMastery,
        [vocabId]: status,
      },
    }));
  };

  const handleToggleStar = (vocabId: string) => {
    setProgress((prev) => {
      const exists = prev.starredVocabIds.includes(vocabId);
      return {
        ...prev,
        starredVocabIds: exists
          ? prev.starredVocabIds.filter((id) => id !== vocabId)
          : [...prev.starredVocabIds, vocabId],
      };
    });
  };

  const handleUpdateMatchBest = (scopeKey: string, timeMs: number) => {
    setProgress((prev) => {
      const prevBest = prev.matchBestTimeMs[scopeKey];
      if (prevBest && prevBest <= timeMs) return prev;
      return {
        ...prev,
        matchBestTimeMs: {
          ...prev.matchBestTimeMs,
          [scopeKey]: timeMs,
        },
      };
    });
  };

  const handleSaveDayQuizResult = (dayKey: string, result: DayQuizResult) => {
    setProgress((prev) => ({
      ...prev,
      dayQuizResults: {
        ...prev.dayQuizResults,
        [dayKey]: result,
      },
    }));
  };

  const handleMarkDayCompleted = (dayNumber: number) => {
    setProgress((prev) => {
      const current = prev.completedDaysByCourse[activeCourse.id] ?? [];
      const exists = current.includes(dayNumber);
      const updated = exists
        ? current.filter((d) => d !== dayNumber)
        : [...current, dayNumber].sort((a, b) => a - b);
      return {
        ...prev,
        completedDaysByCourse: {
          ...prev.completedDaysByCourse,
          [activeCourse.id]: updated,
        },
      };
    });
  };

  const handleOpenQuizletForDay = (day: StudyPlanDay) => {
    setQuizletScope(`day-${day.dayNumber}`);
    setActiveTab('quizlet');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allCourseVocab = useMemo(
    () => activeCourse.units.flatMap((u) => u.vocabItems ?? []),
    [activeCourse]
  );

  const vocabUnits = useMemo(
    () => activeCourse.units.filter((u) => (u.vocabItems?.length ?? 0) > 0),
    [activeCourse]
  );

  const quizletResolved: { key: string; title: string; cards: VocabEntry[] } = useMemo(() => {
    if (quizletScope.startsWith('day-')) {
      const dNum = Number(quizletScope.replace('day-', '')) || selectedDayNumber;
      const dayObj = planDays.find((d) => d.dayNumber === dNum) ?? planDays[0];
      if (dayObj) {
        return {
          key: `${activeCourse.id}-day-${dayObj.dayNumber}`,
          title: `Từ vựng Ngày ${dayObj.dayNumber} · ${dayObj.title}`,
          cards: dayObj.vocabPool,
        };
      }
    }
    if (quizletScope.startsWith('unit-')) {
      const uId = quizletScope.replace('unit-', '');
      const uObj = activeCourse.units.find((u) => u.id === uId);
      if (uObj) {
        return {
          key: `${activeCourse.id}-${uObj.id}`,
          title: `${uObj.title}: ${uObj.topic}`,
          cards: uObj.vocabItems ?? [],
        };
      }
    }
    return {
      key: `${activeCourse.id}-all`,
      title: `Toàn bộ từ vựng · ${activeCourse.title}`,
      cards: allCourseVocab,
    };
  }, [quizletScope, activeCourse, planDays, selectedDayNumber, allCourseVocab]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* Clean, basic 3-zone top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            LexiPlan
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto">
            <NavLink
              active={activeTab === 'plan'}
              onClick={() => setActiveTab('plan')}
              label="Lộ trình học"
            />
            <NavLink
              active={activeTab === 'lesson'}
              onClick={() => setActiveTab('lesson')}
              label="Học theo buổi"
            />
            <NavLink
              active={activeTab === 'quizlet'}
              onClick={() => setActiveTab('quizlet')}
              label="Quizlet Vocab"
            />
            <NavLink
              active={activeTab === 'vault'}
              onClick={() => setActiveTab('vault')}
              label="Kho tài liệu"
            />
          </nav>

          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">Import tài liệu</span>
            <span className="sm:hidden">Import</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Cloud DB Sync & Account Bar */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 mb-6 flex flex-wrap items-center justify-between gap-3">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2.5 text-sm text-slate-700 min-w-0">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
                )}
                <span className="font-medium text-slate-900 truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-slate-300">·</span>
                {syncState === 'connecting' || syncState === 'saving' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {syncState === 'connecting' ? 'Đang tải dữ liệu...' : 'Đang lưu DB...'}
                  </span>
                ) : syncState === 'error' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                    <CloudOff className="w-3.5 h-3.5" />
                    {authMessage || 'Lỗi đồng bộ Cloud DB'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <Cloud className="w-3.5 h-3.5" />
                    Đã lưu Cloud DB
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {syncState === 'error' && (
                  <button
                    type="button"
                    onClick={() => setSyncRetryNonce((n) => n + 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Thử kết nối lại
                  </button>
                )}
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Đăng xuất
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                <CloudOff className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  {authMessage ||
                    'Đang lưu tạm trên trình duyệt. Đăng nhập Google để lưu Database và đồng bộ nhiều thiết bị.'}
                </span>
              </div>

              <button
                type="button"
                disabled={authBusy}
                onClick={handleSignInGoogle}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 shrink-0"
              >
                {authBusy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                Đăng nhập Google
              </button>
            </>
          )}
        </div>

        {activeTab === 'plan' && (
          <StudyPlanView
            courses={courses}
            activeCourse={activeCourse}
            onSelectCourse={handleSelectCourse}
            selectedDays={selectedDays}
            onChangeDays={handleChangeDays}
            planDays={planDays}
            completedDays={completedDays}
            onStartDay={handleStartDay}
            onOpenQuizletAll={() => {
              setQuizletScope('all');
              setActiveTab('quizlet');
            }}
            onOpenImport={() => setImportOpen(true)}
          />
        )}

        {activeTab === 'lesson' && (
          <LessonWorkspace
            course={activeCourse}
            planDays={planDays}
            selectedDayNumber={selectedDayNumber}
            onSelectDay={setSelectedDayNumber}
            completedDays={completedDays}
            exerciseState={progress.exerciseState}
            onSaveExerciseState={handleSaveExerciseState}
            dayQuizResults={progress.dayQuizResults}
            onSaveDayQuizResult={handleSaveDayQuizResult}
            starredVocabIds={progress.starredVocabIds}
            onToggleStar={handleToggleStar}
            onMarkDayCompleted={handleMarkDayCompleted}
            onOpenQuizletForDay={handleOpenQuizletForDay}
          />
        )}

        {activeTab === 'quizlet' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Chọn bộ từ vựng
                </h2>
                <p className="text-xs text-slate-500">
                  Học theo từng ngày, theo Unit hoặc toàn bộ khóa học.
                </p>
              </div>
              <select
                value={quizletScope}
                onChange={(e) => setQuizletScope(e.target.value)}
                aria-label="Chọn bộ từ vựng Quizlet"
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-600 max-w-sm"
              >
                <option value="all">
                  Toàn bộ khóa học ({allCourseVocab.length} thẻ)
                </option>
                <optgroup label="Theo ngày trong lộ trình">
                  {planDays.map((d) => (
                    <option key={d.dayNumber} value={`day-${d.dayNumber}`}>
                      Ngày {d.dayNumber}: {d.title} ({d.vocabPool.length} thẻ)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Theo từng Unit">
                  {vocabUnits.map((u) => (
                    <option key={u.id} value={`unit-${u.id}`}>
                      {u.title}: {u.topic} ({u.vocabItems?.length ?? 0} thẻ)
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <QuizletStudio
              scopeKey={quizletResolved.key}
              scopeTitle={quizletResolved.title}
              vocabPool={quizletResolved.cards}
              allCourseVocab={allCourseVocab}
              vocabMastery={progress.vocabMastery}
              starredIds={progress.starredVocabIds}
              matchBestTimeMs={progress.matchBestTimeMs}
              onSetMastery={handleSetMastery}
              onToggleStar={handleToggleStar}
              onUpdateMatchBest={handleUpdateMatchBest}
            />
          </div>
        )}

        {activeTab === 'vault' && (
          <ReferenceVault
            courses={courses}
            activeCourse={activeCourse}
            onSelectCourse={handleSelectCourse}
            onDeleteCourse={handleDeleteCourse}
            onOpenImport={() => setImportOpen(true)}
          />
        )}
      </main>

      <ImportDocumentModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCourseImported={handleCourseImported}
      />
    </div>
  );
}

function NavLink({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        active
          ? 'border-blue-600 text-blue-600 font-semibold'
          : 'border-transparent text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}
