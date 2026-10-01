import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export class LLMService {
  public static async generateResponse(
    systemPrompt: string,
    _history: any[],
    userMessage: string,
    _undefinedParam: undefined,
    accountId: string,
    modelId: string,
  ): Promise<{ text: string }> {
    console.log("¿La API Key existe?:", !!process.env.GEMINI_API_KEY);

    try {
      const modelTarget = (modelId || "gemini-2.5-flash").replace(/^google\//, "");

      const response = await ai.models.generateContent({
        model: modelTarget,
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
        },
      });

      return {
        text: response.text || "No se recibió respuesta del modelo.",
      };
    } catch (error) {
      console.error(`[LLM_SERVICE_ERROR] Error en cuenta ${accountId}:`, error);
      throw new Error(
        "Falló la comunicación con el servicio de Inteligencia Artificial.",
      );
    }
  }
}
