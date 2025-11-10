/**
 * Splits text by sentences, attempting to create chunks below a maximum size.
 * This is a simple implementation and may not be perfect for all languages.
 * @param text The full text to chunk.
 * @param maxChunkSize The maximum number of characters for each chunk.
 * @returns An array of text chunks.
 */
export function chunkTextBySentences(text: string, maxChunkSize: number = 4500): string[] {
  // If the text is already small enough, no need to chunk.
  if (text.length <= maxChunkSize) {
    return [text];
  }

  // A simple regex to split text into sentences. It keeps the delimiter.
  const sentences = text.match(/[^.!?]+[.!?]*\s*|.+$/g) || [];

  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length === 0) continue;
    
    // If adding the new sentence would exceed the max size,
    // push the current chunk and start a new one.
    // Also handles cases where a single sentence is larger than the maxChunkSize.
    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
    
    // Add the sentence to the current chunk
    currentChunk += trimmedSentence + ' ';
  }

  // Add the last remaining chunk if it exists.
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
