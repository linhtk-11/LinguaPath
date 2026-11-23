import React, { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Volume2,
  Trash2,
  UploadCloud,
  CheckCircle2,
  BookOpen,
  ExternalLink,
} from 'lucide-react';
import { CourseDocument } from '../types/curriculum';
import { speakEnglish } from '../utils/speech';

interface ReferenceVaultProps {
  courses: CourseDocument[];
  activeCourse: CourseDocument;
  onSelectCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  onOpenImport: () => void;
}

export const ReferenceVault: React.FC<ReferenceVaultProps> = ({
  courses,
  activeCourse,
  onSelectCourse,
  onDeleteCourse,
  onOpenImport,
}) => {
  const [tab, setTab] = useState<'courses' | 'verbs' | 'vocab' | 'pdf'>('courses');
  const [query, setQuery] = useState('');

  const allVocab = useMemo(
    () => activeCourse.units.flatMap((u) => u.vocabItems ?? []),
    [activeCourse]
  );

  const irregularVerbs = activeCourse.irregularVerbs ?? [];

  const filteredVerbs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return irregularVerbs;
    return irregularVerbs.filter(
      (v) =>
        v.bare.toLowerCase().includes(q) ||
        v.pastSimple.toLowerCase().includes(q) ||
        v.pastParticiple.toLowerCase().includes(q) ||
        v.vietnamese.toLowerCase().includes(q)
    );
  }, [irregularVerbs, query]);

  const filteredVocab = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allVocab;
    return allVocab.filter(
      (v) =>
        v.term.toLowerCase().includes(q) ||
        v.vietnamese.toLowerCase().includes(q) ||
        v.definition.toLowerCase().includes(q)
    );
  }, [allVocab, query]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Kho tài liệu &amp; Tra cứu
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Chuyển đổi giáo trình, tra từ vựng, động từ bất quy tắc hoặc xem tài liệu PDF gốc.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            <UploadCloud className="w-4 h-4" />
            Import tài liệu
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setTab('courses')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
              tab === 'courses'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Giáo trình ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('vocab')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
              tab === 'vocab'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Từ điển ({allVocab.length})
          </button>
          {irregularVerbs.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('verbs')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
                tab === 'verbs'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Động từ bất quy tắc ({irregularVerbs.length})
            </button>
          )}
          {activeCourse.sourcePdfPath && (
            <button
              type="button"
              onClick={() => setTab('pdf')}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
                tab === 'pdf'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Xem PDF gốc
            </button>
          )}
        </div>
      </div>

      {tab === 'courses' && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {courses.map((c) => {
            const isActive = c.id === activeCourse.id;
            const vocabCount = c.units.reduce((s, u) => s + (u.vocabItems?.length ?? 0), 0);
            const isBuiltIn = c.id === 'destination-b1';

            return (
              <div
                key={c.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{c.level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{c.units.length} bài học</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{vocabCount} từ vựng</span>
                    {isActive && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đang học
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                  <p className="text-sm text-slate-600">{c.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectCourse(c.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isActive ? 'Đang chọn' : 'Chọn học'}
                  </button>

                  {!isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => onDeleteCourse(c.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 hover:bg-red-50 text-xs font-medium text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(tab === 'verbs' || tab === 'vocab') && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'verbs'
                  ? 'Tìm động từ (vd: go, went, ăn...)'
                  : 'Tìm từ vựng tiếng Anh hoặc tiếng Việt...'
              }
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
            />
          </div>

          {tab === 'verbs' ? (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">V1</th>
                    <th className="py-2.5 px-4 font-semibold">V2</th>
                    <th className="py-2.5 px-4 font-semibold">V3</th>
                    <th className="py-2.5 px-4 font-semibold">Nghĩa</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Nghe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVerbs.map((v) => (
                    <tr key={v.bare} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{v.bare}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-800">{v.pastSimple}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-800">{v.pastParticiple}</td>
                      <td className="py-2.5 px-4 text-slate-700">{v.vietnamese}</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => speakEnglish(`${v.bare}, ${v.pastSimple}, ${v.pastParticiple}`)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {filteredVocab.slice(0, 120).map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold text-slate-900">{item.term}</span>
                      {item.partOfSpeech && (
                        <span className="font-mono text-xs text-slate-500">({item.partOfSpeech})</span>
                      )}
                      <span className="text-sm font-medium text-blue-700">— {item.vietnamese}</span>
                      <span className="text-xs text-slate-400">Unit {item.unitNumber}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{item.definition}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakEnglish(item.term)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredVocab.length > 120 && (
                <div className="p-3 text-center text-xs text-slate-500 bg-slate-50">
                  Hiển thị 120/{filteredVocab.length} từ. Gõ từ khóa để tìm nhanh hơn.
                </div>
              )}
              {filteredVocab.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  <BookOpen className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  Không tìm thấy từ vựng nào.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'pdf' && activeCourse.sourcePdfPath && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{activeCourse.sourceFileName || 'Tài liệu PDF gốc'}</span>
            </div>
            <a
              href={activeCourse.sourcePdfPath}
              download
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Tải PDF
            </a>
          </div>
          <iframe
            src={activeCourse.sourcePdfPath}
            title={activeCourse.title}
            className="w-full h-[640px] rounded-lg border border-slate-200"
          />
        </div>
      )}
    </div>
  );
};
