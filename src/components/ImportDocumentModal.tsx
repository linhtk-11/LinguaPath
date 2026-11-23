import React, { useState } from 'react';
import { X, UploadCloud, FileText, Loader2, AlertCircle } from 'lucide-react';
import { CourseDocument } from '../types/curriculum';

interface ImportDocumentModalProps {
  open: boolean;
  onClose: () => void;
  onCourseImported: (course: CourseDocument) => void;
}

const DAY_PRESETS = [7, 14, 21, 30, 42];

export const ImportDocumentModal: React.FC<ImportDocumentModalProps> = ({
  open,
  onClose,
  onCourseImported,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number>(14);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !textContent.trim()) {
      setError('Vui lòng chọn tệp (PDF, TXT, MD) hoặc dán nội dung cần học.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      formData.append('days', String(Math.max(1, Math.min(180, days))));
      if (title.trim()) formData.append('title', title.trim());
      if (textContent.trim()) formData.append('textContent', textContent.trim());

      const res = await fetch('/api/courses/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể phân tích tài liệu.');
      }
      if (!data.course) {
        throw new Error('Dữ liệu trả về không hợp lệ.');
      }

      onCourseImported(data.course as CourseDocument);
      setFile(null);
      setTitle('');
      setTextContent('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi tạo lộ trình học.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            Import tài liệu học mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Chọn file tài liệu (PDF, TXT, Markdown)
            </label>
            <label className="flex flex-col items-center justify-center gap-1.5 p-5 border border-dashed border-slate-300 hover:border-blue-500 rounded-lg bg-slate-50 transition-colors cursor-pointer text-center">
              <UploadCloud className="w-6 h-6 text-blue-600" />
              {file ? (
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{file.name}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-600">
                  Nhấn để chọn tệp từ máy (tối đa 30 MB)
                </span>
              )}
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">
              Số ngày muốn hoàn thành
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {DAY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDays(preset)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer tabular-nums ${
                    days === preset
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {preset} ngày
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={180}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-mono text-center tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">
              Tên khóa học (tùy chọn)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Từ vựng IELTS hoặc Tài liệu ngữ pháp"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">
              Hoặc dán trực tiếp nội dung văn bản / từ vựng
            </label>
            <textarea
              rows={4}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Dán nội dung tiếng Anh hoặc danh sách từ vựng vào đây..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:border-blue-600"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Đang tạo khóa học...' : 'Tạo lộ trình học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
