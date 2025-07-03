
export const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      // If the signal is already aborted, reject immediately.
      const abortError = new DOMException('Aborted', 'AbortError');
      console.warn('Delay aborted before starting:', abortError.message);
      return reject(abortError);
    }

    const timeoutId = setTimeout(resolve, ms);

    const abortListener = () => {
      clearTimeout(timeoutId);
      const abortError = new DOMException('Aborted', 'AbortError');
      console.warn('Delay aborted during timeout:', abortError.message);
      reject(abortError);
    };

    signal?.addEventListener('abort', abortListener, { once: true });
  });
};

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return blob;
}