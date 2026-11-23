export function speakEnglish(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang === 'en-GB' && v.name.includes('Google')) ||
      voices.find((v) => v.lang.startsWith('en-GB')) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferred) {
      utterance.voice = preferred;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore speech synthesis errors on restricted environments
  }
}
