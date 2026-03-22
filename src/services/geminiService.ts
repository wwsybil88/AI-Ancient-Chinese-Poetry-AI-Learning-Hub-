import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
};

export interface AuthorProfile {
  name: { cn: string; en: string };
  dynasty: { cn: string; en: string };
  dates: { cn: string; en: string };
  bio: { cn: string; en: string };
  works: { cn: string[]; en: string[] };
  titles: { cn: string[]; en: string[] };
  portraitUrl: string;
}

export interface Keyword {
  word: string;
  pinyin: string;
  annotation: { cn: string; en: string };
}

export interface RelatedPoem {
  title: { cn: string; en: string };
  author: string;
  reason: { cn: string; en: string };
}

export interface PoetryAnalysis {
  title: { cn: string; en: string };
  author: AuthorProfile;
  content: string[];
  pinyin: string[];
  translation: { cn: string; en: string };
  interpretation: { cn: string; en: string };
  sentiment: { cn: string; en: string };
  imagery: { cn: string; en: string };
  emotionalTags: { cn: string[]; en: string[] };
  keywords: Keyword[];
  relatedPoems: RelatedPoem[];
  visualPrompt: string;
}

const cache = new Map<string, { analysis: PoetryAnalysis; audioUrl: string }>();

export const analyzePoetry = async (poemText: string): Promise<PoetryAnalysis> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `Analyze the following ancient Chinese poem and provide a detailed bi-lingual response (CN/EN).
    Include a comprehensive profile of the author.
    Extract key vocabulary/difficult characters (keywords) with Pinyin and annotations.
    Suggest 1-3 related poems based on theme or style.
    The English content should be natural, academic yet accessible for K-12 students.
    
    Poem: ${poemText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { 
            type: Type.OBJECT, 
            properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["cn", "en"]
          },
          author: { 
            type: Type.OBJECT, 
            properties: {
              name: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] },
              dynasty: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] },
              dates: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] },
              bio: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] },
              works: { type: Type.OBJECT, properties: { cn: { type: Type.ARRAY, items: { type: Type.STRING } }, en: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["cn", "en"] },
              titles: { type: Type.OBJECT, properties: { cn: { type: Type.ARRAY, items: { type: Type.STRING } }, en: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["cn", "en"] },
              portraitUrl: { type: Type.STRING },
            },
            required: ["name", "dynasty", "bio", "works"]
          },
          content: { type: Type.ARRAY, items: { type: Type.STRING } },
          pinyin: { type: Type.ARRAY, items: { type: Type.STRING } },
          translation: { 
            type: Type.OBJECT, 
            properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["cn", "en"]
          },
          interpretation: { 
            type: Type.OBJECT, 
            properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["cn", "en"]
          },
          sentiment: { 
            type: Type.OBJECT, 
            properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["cn", "en"]
          },
          imagery: { 
            type: Type.OBJECT, 
            properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } },
            required: ["cn", "en"]
          },
          emotionalTags: { 
            type: Type.OBJECT, 
            properties: { 
              cn: { type: Type.ARRAY, items: { type: Type.STRING } }, 
              en: { type: Type.ARRAY, items: { type: Type.STRING } } 
            },
            required: ["cn", "en"]
          },
          keywords: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                pinyin: { type: Type.STRING },
                annotation: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] }
              },
              required: ["word", "pinyin", "annotation"]
            }
          },
          relatedPoems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] },
                author: { type: Type.STRING },
                reason: { type: Type.OBJECT, properties: { cn: { type: Type.STRING }, en: { type: Type.STRING } }, required: ["cn", "en"] }
              },
              required: ["title", "author", "reason"]
            }
          },
          visualPrompt: { type: Type.STRING },
        },
        required: ["title", "author", "content", "pinyin", "translation", "interpretation", "sentiment", "imagery", "emotionalTags", "keywords", "relatedPoems"],
      },
    },
  });

  const result = JSON.parse(response.text);
  // Fallback portrait if none provided
  if (!result.author.portraitUrl || result.author.portraitUrl.includes("placeholder")) {
    result.author.portraitUrl = `https://picsum.photos/seed/${result.author.name.en}/400/600`;
  }
  return result;
};

export const getCachedResult = (poemText: string) => cache.get(poemText);
export const setCachedResult = (poemText: string, data: { analysis: PoetryAnalysis; audioUrl: string }) => cache.set(poemText, data);


export const generateTTS = async (text: string): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Recite this ancient Chinese poem with a professional storytelling tone, deep emotional resonance, and precise Mandarin pronunciation. Capture the rhythm and soul of the verses: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate TTS");
  return `data:audio/mp3;base64,${base64Audio}`;
};
