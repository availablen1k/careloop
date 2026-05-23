import { GoogleGenerativeAI } from '@google/generative-ai';
import { mockGeminiCall } from './mockGemini';

export async function callGeminiJson<T>({
  system,
  prompt,
  schemaName,
  fallback,
}: {
  system: string;
  prompt: string;
  schemaName: string;
  fallback: T;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return mockGeminiCall(system, prompt, schemaName, fallback);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: system,
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const text = result.response.text();
    if (!text) {
      console.warn(`Empty response for ${schemaName}, falling back to mock.`);
      return mockGeminiCall(system, prompt, schemaName, fallback);
    }
    
    // Parse the JSON. Clean markdown formatting if present.
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```')) {
      const lines = cleanedText.split('\n');
      if (lines[0].startsWith('```')) {
        lines.shift();
      }
      if (lines[lines.length - 1].startsWith('```')) {
        lines.pop();
      }
      cleanedText = lines.join('\n').trim();
    }

    const parsed = JSON.parse(cleanedText);
    return parsed as T;
  } catch (error) {
    console.error(`Gemini call failed for ${schemaName}, falling back to mock:`, error);
    return mockGeminiCall(system, prompt, schemaName, fallback);
  }
}
