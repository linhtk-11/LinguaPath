import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });
}

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('429') || msg.includes('503') || msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

const COURSE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Course title based on the imported document' },
    subtitle: { type: Type.STRING, description: 'Short descriptive subtitle in Vietnamese/English' },
    level: { type: Type.STRING, description: 'Estimated CEFR level (e.g., A2, B1, B2, C1, IELTS)' },
    units: {
      type: Type.ARRAY,
      description: 'Complete sequence of study units covering every topic in the uploaded document',
      items: {
        type: Type.OBJECT,
        properties: {
          unitNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          topic: { type: Type.STRING },
          type: { type: Type.STRING, description: 'Must be grammar or vocabulary' },
          estimatedMinutes: { type: Type.INTEGER },
          summaryVi: { type: Type.STRING, description: 'Clear Vietnamese overview of what the learner masters in this unit' },
          grammarSections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                formSummary: { type: Type.STRING },
                uses: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      use: { type: Type.STRING },
                      example: { type: Type.STRING },
                    },
                    required: ['use', 'example'],
                  },
                },
                helpfulHints: { type: Type.ARRAY, items: { type: Type.STRING } },
                watchOut: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['heading', 'uses'],
            },
          },
          vocabItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description: 'One of: topic_vocab, phrasal_verb, prepositional_phrase, word_formation, word_pattern',
                },
                term: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                definition: { type: Type.STRING },
                vietnamese: { type: Type.STRING },
                example: { type: Type.STRING },
              },
              required: ['category', 'term', 'definition', 'vietnamese', 'example'],
            },
          },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                title: { type: Type.STRING },
                kind: { type: Type.STRING, description: 'One of: fill, choice, transform' },
                wordBank: { type: Type.ARRAY, items: { type: Type.STRING } },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      number: { type: Type.INTEGER },
                      prompt: { type: Type.STRING },
                      keyword: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      answer: { type: Type.STRING },
                    },
                    required: ['number', 'prompt', 'answer'],
                  },
                },
              },
              required: ['label', 'title', 'kind', 'items'],
            },
          },
        },
        required: ['unitNumber', 'title', 'topic', 'type', 'estimatedMinutes', 'summaryVi', 'exercises'],
      },
    },
  },
  required: ['title', 'subtitle', 'level', 'units'],
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/courses/import', upload.single('file'), async (req, res) => {
  try {
    const ai = getAI();
    const requestedDays = Math.max(1, Math.min(180, Number(req.body?.days) || 14));
    const customTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const customLevel = typeof req.body?.level === 'string' ? req.body.level.trim() : '';
    const textContent = typeof req.body?.textContent === 'string' ? req.body.textContent.trim() : '';
    const file = req.file;

    if (!file && !textContent) {
      res.status(400).json({ error: 'Vui lòng tải lên tệp tài liệu (PDF/TXT/MD) hoặc dán nội dung học.' });
      return;
    }

    const promptInstruction = `Bạn là chuyên gia biên soạn giáo trình tiếng Anh.
Nhiệm vụ: Phân tích TOÀN BỘ tài liệu được cung cấp và chuyển đổi thành khóa học tương tác có cấu trúc đầy đủ để người học hoàn thành trọn vẹn trong ${requestedDays} ngày.

Yêu cầu bắt buộc:
1. Không bỏ sót kiến thức trọng tâm từ tài liệu. Hãy chia tài liệu thành các Unit học mạch lạc (tối thiểu ${Math.min(12, Math.max(3, requestedDays))} unit nếu tài liệu dài, hoặc khớp từng bài/chương trong tài liệu).
2. Mỗi Unit cần có:
   - \`type\`: "grammar" hoặc "vocabulary".
   - \`summaryVi\`: tóm tắt tiếng Việt ngắn gọn, dễ hiểu.
   - Nếu có điểm ngữ pháp: điền đầy đủ \`grammarSections\` (công thức, cách dùng + ví dụ thực tế, \`helpfulHints\`, \`watchOut\`).
   - Quan trọng: MỖI unit đều nên trích xuất \`vocabItems\` (tối thiểu 6–12 từ/cụm từ/collocation/phrasal verb tiêu biểu của bài đó kèm nghĩa tiếng Anh, nghĩa tiếng Việt chính xác, partOfSpeech, ví dụ) để phục vụ học Quizlet (Flashcards, Learn, Match, Write) và bài kiểm tra từ vựng cuối buổi!
   - \`exercises\`: tối thiểu 2 dạng bài tập tương tác cho mỗi unit (ví dụ "fill" điền từ vào chỗ trống \`___\`, "choice" trắc nghiệm 4 lựa chọn, hoặc "transform" viết lại câu). Với "fill", đảm bảo dùng \`___\` làm chỗ trống và \`answer\` rõ ràng (có thể ngăn cách các đáp án đúng bằng dấu \`|\`).
3. ${customTitle ? `Tiêu đề ưu tiên: "${customTitle}".` : 'Tự đặt tiêu đề khóa học chuẩn xác theo tài liệu.'}
4. ${customLevel ? `Trình độ mục tiêu: "${customLevel}".` : 'Xác định trình độ CEFR phù hợp.'}
Trả về JSON đúng theo schema.`;

    const contentsParts: Array<
      | { text: string }
      | { inlineData: { data: string; mimeType: string } }
    > = [{ text: promptInstruction }];

    let sourceFileName: string | undefined;

    if (file) {
      sourceFileName = file.originalname;
      const lowerName = file.originalname.toLowerCase();
      if (file.mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
        contentsParts.push({
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        });
      } else {
        const decodedText = file.buffer.toString('utf-8').slice(0, 120000);
        contentsParts.push({ text: `--- NỘI DUNG TỆP (${file.originalname}) ---\n${decodedText}` });
      }
    }

    if (textContent) {
      contentsParts.push({ text: `--- NỘI DUNG BỔ SUNG / GHI CHÚ ---\n${textContent.slice(0, 120000)}` });
    }

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contentsParts,
        config: {
          responseMimeType: 'application/json',
          responseSchema: COURSE_RESPONSE_SCHEMA,
        },
      })
    );

    const rawText = response.text;
    if (!rawText) {
      res.status(502).json({ error: 'AI không trả về dữ liệu khóa học hợp lệ.' });
      return;
    }

    const parsed = JSON.parse(rawText);
    const courseId = `custom-${Date.now()}`;

    const units = Array.isArray(parsed.units)
      ? parsed.units.map((u: Record<string, unknown>, idx: number) => {
          const uNum = Number(u.unitNumber) || idx + 1;
          const uType = u.type === 'vocabulary' ? 'vocabulary' : 'grammar';
          const uTitle = String(u.title || `Unit ${uNum}`);
          const vocabItems = Array.isArray(u.vocabItems)
            ? u.vocabItems.map((v: Record<string, unknown>, vIdx: number) => ({
                id: `${courseId}-u${uNum}-v${vIdx + 1}`,
                unitNumber: uNum,
                unitTitle: uTitle,
                category: ['topic_vocab', 'phrasal_verb', 'prepositional_phrase', 'word_formation', 'word_pattern'].includes(
                  String(v.category)
                )
                  ? String(v.category)
                  : 'topic_vocab',
                term: String(v.term || ''),
                partOfSpeech: v.partOfSpeech ? String(v.partOfSpeech) : undefined,
                definition: String(v.definition || ''),
                vietnamese: String(v.vietnamese || ''),
                example: String(v.example || ''),
              }))
            : [];

          const exercises = Array.isArray(u.exercises)
            ? u.exercises.map((ex: Record<string, unknown>, exIdx: number) => ({
                id: `${courseId}-u${uNum}-ex${exIdx + 1}`,
                label: String(ex.label || String.fromCharCode(65 + exIdx)),
                title: String(ex.title || 'Practice Exercise'),
                kind: ['fill', 'choice', 'transform'].includes(String(ex.kind)) ? String(ex.kind) : 'fill',
                wordBank: Array.isArray(ex.wordBank) ? ex.wordBank.map(String) : undefined,
                items: Array.isArray(ex.items)
                  ? ex.items.map((it: Record<string, unknown>, itIdx: number) => ({
                      id: `${courseId}-u${uNum}-ex${exIdx + 1}-i${itIdx + 1}`,
                      number: Number(it.number) || itIdx + 1,
                      prompt: String(it.prompt || ''),
                      keyword: it.keyword ? String(it.keyword) : undefined,
                      options: Array.isArray(it.options) ? it.options.map(String) : undefined,
                      answer: String(it.answer || ''),
                    }))
                  : [],
              }))
            : [];

          return {
            id: `${courseId}-u${uNum}`,
            unitNumber: uNum,
            title: uTitle,
            topic: String(u.topic || uTitle),
            type: uType,
            estimatedMinutes: Number(u.estimatedMinutes) || 25,
            summaryVi: String(u.summaryVi || ''),
            grammarSections: Array.isArray(u.grammarSections) ? u.grammarSections : undefined,
            vocabItems,
            exercises,
          };
        })
      : [];

    if (units.length === 0) {
      res.status(502).json({ error: 'Không thể tách được Unit học từ tài liệu này. Hãy thử tệp rõ ràng hơn.' });
      return;
    }

    res.json({
      course: {
        id: courseId,
        title: customTitle || String(parsed.title || sourceFileName || 'Khóa học tiếng Anh mới'),
        subtitle: String(parsed.subtitle || `Tạo tự động từ tài liệu · Lộ trình ${requestedDays} ngày`),
        level: customLevel || String(parsed.level || 'Intermediate (B1–B2)'),
        sourceFileName,
        defaultDays: requestedDays,
        units,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Import course error:', err);
    const message = err instanceof Error ? err.message : 'Lỗi máy chủ khi xử lý tài liệu.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/explain', async (req, res) => {
  try {
    const ai = getAI();
    const { prompt, answer, userAnswer, unitTitle } = req.body ?? {};
    if (!prompt || !answer) {
      res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi cần giải thích.' });
      return;
    }

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Bạn là giáo viên tiếng Anh chuyên luyện thi B1/B2. Hãy giải thích ngắn gọn, dễ nhớ bằng tiếng Việt (giữ thuật ngữ tiếng Anh chính xác):
- Bài học: ${unitTitle || 'English Grammar & Vocabulary'}
- Câu hỏi: ${prompt}
- Đáp án đúng: ${answer}
- Câu trả lời của học viên: ${userAnswer || '(chưa nhập)'}

Hãy trình bày 2–3 câu rõ ràng: (1) Vì sao đáp án đúng là "${answer}", (2) Nếu học viên làm sai thì lỗi nằm ở đâu, (3) Mẹo ghi nhớ nhanh.`,
      })
    );

    res.json({ explanation: response.text || 'Không thể tạo lời giải thích lúc này.' });
  } catch (err) {
    console.error('Explain error:', err);
    const message = err instanceof Error ? err.message : 'Lỗi khi gọi AI giải thích.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/generate-practice', async (req, res) => {
  try {
    const ai = getAI();
    const { unitTitle, topic, type, sampleTerms } = req.body ?? {};
    if (!unitTitle) {
      res.status(400).json({ error: 'Thiếu tên Unit để tạo bài tập.' });
      return;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.INTEGER },
              prompt: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answer: { type: Type.STRING },
            },
            required: ['number', 'prompt', 'options', 'answer'],
          },
        },
      },
      required: ['items'],
    };

    const response = await callGeminiWithRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Tạo 5 câu hỏi trắc nghiệm tiếng Anh (4 lựa chọn A/B/C/D) trình độ B1 để luyện thêm cho bài học:
- Unit: ${unitTitle}
- Chủ đề: ${topic || unitTitle}
- Trọng tâm: ${type || 'grammar & vocabulary'}
- Từ vựng gợi ý: ${Array.isArray(sampleTerms) ? sampleTerms.slice(0, 12).join(', ') : ''}

Mỗi câu hỏi có chỗ trống "___", 4 options rõ ràng, và "answer" khớp chính xác 1 trong 4 options.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      })
    );

    const parsed = JSON.parse(response.text || '{}');
    res.json({ items: Array.isArray(parsed.items) ? parsed.items : [] });
  } catch (err) {
    console.error('Generate practice error:', err);
    const message = err instanceof Error ? err.message : 'Lỗi khi tạo thêm câu hỏi.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LexiPlan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
