import React from 'react';
import {
  ArrowRight,
  Layers,
  UploadCloud,
} from 'lucide-react';
import { CourseDocument, StudyPlanDay } from '../types/curriculum';

interface StudyPlanViewProps {
  courses: CourseDocument[];
  activeCourse: CourseDocument;
  onSelectCourse: (courseId: string) => void;
  selectedDays: number;
  onChangeDays: (days: number) => void;
  planDays: StudyPlanDay[];
  completedDays: number[];
  onStartDay: (dayNumber: number) => void;
  onOpenQuizletAll: () => void;
  onOpenImport: () => void;
}

const QUICK_DAYS = [7, 14, 21, 30, 42];

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  courses,
  activeCourse,
  onSelectCourse,
  selectedDays,
  onChangeDays,
  planDays,
  completedDays,
  onStartDay,
  onOpenQuizletAll,
  onOpenImport,
}) => {
  const totalVocabCount = activeCourse.units.reduce(
    (sum, u) => sum + (u.vocabItems?.length ?? 0),
    0
  );
  const completionPct = Math.round(
    (completedDays.length / Math.max(1, planDays.length)) * 100
  );
  const nextDay =
    planDays.find((d) => !completedDays.includes(d.dayNumber))?.dayNumber ?? 1;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Clean Overview Box */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{activeCourse.level}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{activeCourse.units.length} bài học</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{totalVocabCount} từ vựng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {activeCourse.title}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              {activeCourse.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onStartDay(nextDay)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Học Ngày {nextDay}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onOpenQuizletAll}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Layers className="w-4 h-4 text-slate-500" />
              <span>Học từ vựng Quizlet</span>
            </button>
          </div>
        </div>

        {/* Course picker (if multiple) + Simple Day Plan Selector */}
        <div className="pt-5 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="study-days-input"
                className="text-sm font-medium text-slate-800"
              >
                Số ngày bạn muốn học hết tài liệu:
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_DAYS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onChangeDays(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer tabular-nums whitespace-nowrap shrink-0 ${
                      selectedDays === preset
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset} ngày
                  </button>
                ))}
                <input
                  id="study-days-input"
                  type="number"
                  min={1}
                  max={180}
                  value={selectedDays}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                    onChangeDays(val);
                  }}
                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono font-semibold text-center tabular-nums focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {courses.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label
                  htmlFor="active-course-select"
                  className="text-xs font-medium text-slate-500"
                >
                  Đang chọn giáo trình:
                </label>
                <select
                  id="active-course-select"
                  value={activeCourse.id}
                  onChange={(e) => onSelectCourse(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.units.length} units)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onOpenImport}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Thêm tài liệu mới
                </button>
              </div>
            )}
          </div>

          <div className="w-full lg:w-64 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
              <span>Tiến độ lộ trình</span>
              <span className="font-semibold text-slate-900">
                {completedDays.length}/{planDays.length} ngày ({completionPct}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Simple Clean Syllabus List */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
        {planDays.map((day) => {
          const isDone = completedDays.includes(day.dayNumber);
          const unitNames =
            day.units.length > 0
              ? day.units.map((u) => `Unit ${u.unitNumber}`).join(', ')
              : 'Ôn tập';
          const contentText =
            day.units.length > 0
              ? day.units.map((u) => u.topic).join(' · ')
              : day.title;

          return (
            <div
              key={day.dayNumber}
              onClick={() => onStartDay(day.dayNumber)}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-5 min-w-0">
                <span className="text-sm font-semibold text-blue-600 tabular-nums w-20 shrink-0">
                  Ngày {day.dayNumber}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {unitNames}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {contentText}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartDay(day.dayNumber);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center ${
                  isDone
                    ? 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isDone ? 'Ôn lại' : 'Vào học'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
