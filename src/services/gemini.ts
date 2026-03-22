import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64
}

export interface Message {
  role: "user" | "model";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIModelConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  modelName: string;
}

export interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AgentSettings {
  personality: string;
  style: string;
  customInstructions: string;
}

export async function chatWithAI(
  messages: Message[], 
  config: AIModelConfig,
  fileProtectionEnabled: boolean = true,
  enabledSkills: { name: string, desc: string }[] = [],
  agentSettings?: AgentSettings
): Promise<AIResponse> {
  const protectionRule = fileProtectionEnabled 
    ? "\nCRITICAL SAFETY RULE: You are strictly FORBIDDEN from deleting, removing, or overwriting any files. If asked to do so, politely refuse and explain that File Protection Protocol is active."
    : "";
  
  const skillsInfo = enabledSkills.length > 0 
    ? `\nYou have the following skills enabled: ${enabledSkills.map(s => `\n- ${s.name}: ${s.desc}`).join('')}`
    : "";

  const skillCreationRule = "\nIf you think a new skill would be useful, you can propose it by including `[NEW_SKILL: Name | Description]` in your response. The user can then see it in their library.";
  const taskCreationRule = "\nIf the user asks to schedule a task or you think a recurring task is needed, you can propose it by including `[NEW_TASK: Name | Schedule]` in your response. Schedule should be a cron expression or a human-readable time like 'Every day at 9am'.";

  const personality = agentSettings?.personality ? `\nYour personality: ${agentSettings.personality}` : "";
  const style = agentSettings?.style ? `\nYour response style: ${agentSettings.style}` : "";
  const customInstructions = agentSettings?.customInstructions ? `\nAdditional instructions: ${agentSettings.customInstructions}` : "";

  const systemInstruction = `You are CMCC_Claw, a high-performance AI agent for mobile terminals. You are precise, technical, and helpful. Use markdown for formatting.${personality}${style}${customInstructions}${protectionRule}${skillsInfo}${skillCreationRule}${taskCreationRule}`;

  if (config.provider === 'Google') {
    const apiKey = config.apiKey === '********' ? process.env.GEMINI_API_KEY : config.apiKey;
    if (!apiKey) return { text: "Google API key missing." };
    
    const ai = new GoogleGenAI({ apiKey });
    try {
      const formattedHistory = messages.slice(0, -1).map(m => ({
        role: m.role,
        parts: [
          { text: m.content },
          ...(m.attachments || []).map(a => ({
            inlineData: {
              data: a.data.split(',')[1] || a.data,
              mimeType: a.type
            }
          }))
        ]
      }));
      const lastMessage = messages[messages.length - 1];
      const lastMessageParts: any[] = [{ text: lastMessage.content }];
      if (lastMessage.attachments) {
        lastMessage.attachments.forEach(a => {
          lastMessageParts.push({
            inlineData: {
              data: a.data.split(',')[1] || a.data,
              mimeType: a.type
            }
          });
        });
      }

      // Map common aliases to correct model IDs
      let modelId = config.modelName || "gemini-3-flash-preview";
      if (modelId === 'gemini-3-flash') modelId = 'gemini-3-flash-preview';
      if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';

      const chat = ai.chats.create({
        model: modelId,
        config: { systemInstruction },
        history: formattedHistory
      });
      const result: GenerateContentResponse = await chat.sendMessage({ 
        message: lastMessageParts 
      });

      const usage = result.usageMetadata ? {
        promptTokens: result.usageMetadata.promptTokenCount,
        completionTokens: result.usageMetadata.candidatesTokenCount,
        totalTokens: result.usageMetadata.totalTokenCount
      } : undefined;

      return {
        text: result.text || "No response from AI.",
        usage
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      return {
        text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  } else {
    // OpenAI Compatible API
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const apiKey = config.apiKey;
    if (!apiKey) return { text: `${config.provider} API key missing.` };

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            { role: 'system', content: systemInstruction },
            ...messages.map(m => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.content
            }))
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined;

      return {
        text: data.choices[0]?.message?.content || "No response from AI.",
        usage
      };
    } catch (error) {
      console.error(`${config.provider} API Error:`, error);
      return {
        text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    }
  }
}
