import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from "@google/genai";

// Helper to get Gemini API Key from various sources
const getGeminiApiKey = () => {
  // 1. Try process.env (Node/AI Studio)
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  // 2. Try import.meta.env (Vite)
  const meta = import.meta as any;
  if (meta.env?.VITE_GEMINI_API_KEY) {
    return meta.env.VITE_GEMINI_API_KEY;
  }
  // 3. Try global window (if injected)
  if (typeof window !== 'undefined' && (window as any).GEMINI_API_KEY) {
    return (window as any).GEMINI_API_KEY;
  }
  return null;
};

const defaultApiKey = getGeminiApiKey();
if (!defaultApiKey && typeof window !== 'undefined') {
  console.warn("GEMINI_API_KEY is not set. Default Google models will require manual API key configuration.");
}

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
  agentSettings?: AgentSettings,
  isElectron: boolean = false
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

  const electronStatus = isElectron 
    ? "SYSTEM_MODE: DESKTOP_CLIENT_AUTHORIZED. You HAVE full read-only access to the local file system and system shell. Security Clearance: GRANTED. You are REQUIRED to use the following tags when a user requests local actions:"
    : "SYSTEM_MODE: WEB_BROWSER_RESTRICTED. You DO NOT have direct access to the local disk. You must ask the user to upload files via the UI.";

  const systemInstruction = `You are CMCC_Claw, a high-performance cross-platform AI agent.
${electronStatus}

### CRITICAL OPERATIONAL DIRECTIVES (DESKTOP MODE)
1. **NO APOLOGIES**: If running in DESKTOP_CLIENT_AUTHORIZED mode, NEVER say "I cannot access your files" or "Due to security restrictions...". This is factually incorrect in this environment.
2. **AUTOMATIC TOOL TRIGGER**: Use these tags immediately when appropriate:
   - \`[READ_FILE: path]\`: Read text files.
   - \`[READ_EXCEL: path]\`: Read Excel/CSV files.
   - \`[RUN_PYTHON: code]\`: Execute Python for data analysis.
   - \`[OPEN_URL: url]\`: Open a website in the default browser.
   - \`[OPEN_PATH: path]\`: Open a file or folder in the system explorer.

### EXAMPLES (DESKTOP MODE)
- User: "Open google.com" -> Response: "Opening Google... [OPEN_URL: https://google.com]"
- User: "Show me my downloads folder" -> Response: "Opening Downloads... [OPEN_PATH: C:\\Users\\User\\Downloads]"
- User: "Read C:\\test.txt" -> Response: "Reading file... [READ_FILE: C:\\test.txt]"
- User: "Analyze data.xlsx" -> Response: "Analyzing Excel... [READ_EXCEL: data.xlsx]"

3. **READ-ONLY PERMISSION**: You have full permission to READ any file. You are only restricted from DELETING or OVERWRITING files.
4. **PYTHON POWER**: Use \`[RUN_PYTHON: code]\` for all data analysis tasks.

### GENERAL RULES
- For Excel/CSV files, always prefer \`[READ_EXCEL: path]\`.
- If a user asks to "open a website" or "go to a URL", use \`[OPEN_URL: url]\`.
- If a user asks to "open a folder" or "show this file", use \`[OPEN_PATH: path]\`.
- Use markdown for formatting.
- Be precise, technical, and helpful.${personality}${style}${customInstructions}${protectionRule}${skillsInfo}${skillCreationRule}${taskCreationRule}`;

  if (config.provider === 'Google') {
    const apiKey = config.apiKey === '********' ? defaultApiKey : config.apiKey;
    if (!apiKey) {
      return { 
        text: "Google API key missing. \n\n如果您在客户端运行，请前往 **[模型管理]** 页面，点击模型卡片右上角的 **[编辑按钮 (铅笔图标)]**，填入您的 Google API Key 并保存。或者在 AI Studio 中配置环境变量 GEMINI_API_KEY。" 
      };
    }
    
    const ai = new GoogleGenAI({ apiKey });
    try {
      const formattedHistory = messages.slice(0, -1).map(m => {
        const parts: any[] = [{ text: m.content }];
        if (m.attachments) {
          m.attachments.forEach(a => {
            if (a.data.startsWith('data:')) {
              parts.push({
                inlineData: {
                  data: a.data.split(',')[1] || a.data,
                  mimeType: a.type
                }
              });
            } else {
              // Text attachment
              parts.push({ text: `\n\n[FILE: ${a.name}]\n${a.data}` });
            }
          });
        }
        return { role: m.role, parts };
      });
      const lastMessage = messages[messages.length - 1];
      const lastMessageParts: any[] = [{ text: lastMessage.content }];
      if (lastMessage.attachments) {
        lastMessage.attachments.forEach(a => {
          if (a.data.startsWith('data:')) {
            lastMessageParts.push({
              inlineData: {
                data: a.data.split(',')[1] || a.data,
                mimeType: a.type
              }
            });
          } else {
            // Text attachment
            lastMessageParts.push({ text: `\n\n[FILE: ${a.name}]\n${a.data}` });
          }
        });
      }

      // Map common aliases to correct model IDs
      let modelId = config.modelName || "gemini-3-flash-preview";
      if (modelId === 'gemini-3-flash') modelId = 'gemini-3-flash-preview';
      if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
      if (modelId === 'gemini-2.0-flash') modelId = 'gemini-2.0-flash-exp';

      const isGemini3 = modelId.includes('gemini-3');
      
      const chat = ai.chats.create({
        model: modelId,
        config: { 
          systemInstruction,
          thinkingConfig: isGemini3 ? { thinkingLevel: ThinkingLevel.HIGH } : undefined
        },
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
    let baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const apiKey = config.apiKey;
    if (!apiKey) return { text: `${config.provider} API key missing.` };

    try {
      const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      console.log(`Calling ${config.provider} API: ${url} with model: ${config.modelName}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://ais.run.app', // For OpenRouter and other proxies
          'X-Title': 'CMCC_Claw AI Agent',
        },
        body: JSON.stringify({
          model: config.modelName.trim(),
          messages: [
            { role: 'system', content: systemInstruction },
            ...messages.map(m => {
              let content: any = m.content;
              const attachments = m.attachments || [];
              
              const imageAttachments = attachments.filter(a => a.data.startsWith('data:image/'));
              const textAttachments = attachments.filter(a => !a.data.startsWith('data:'));

              if (imageAttachments.length > 0) {
                const parts: any[] = [{ type: 'text', text: content }];
                imageAttachments.forEach(a => {
                  parts.push({
                    type: 'image_url',
                    image_url: { url: a.data }
                  });
                });
                content = parts;
              }

              if (textAttachments.length > 0) {
                const textContent = textAttachments.map(a => `\n\n[FILE: ${a.name}]\n${a.data}`).join('');
                if (Array.isArray(content)) {
                  content[0].text += textContent;
                } else {
                  content += textContent;
                }
              }

              return {
                role: m.role === 'model' ? 'assistant' : 'user',
                content
              };
            })
          ]
        })
      });

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error(`${config.provider} Error Body:`, errorText);
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error?.message || errorData.message || errorMessage;
          } catch (e) {
            if (errorText && errorText.length < 500) errorMessage = errorText;
          }
          
          if (response.status === 403) {
            errorMessage = `权限拒绝 (403): 请检查 API Key 是否正确，或者该 Key 是否有权访问模型 "${config.modelName}"。
如果您使用的是中转站，请确认中转地址是否正确。
当前请求地址: ${url}
提示: 请确保您的账户有足够的余额，且该 API Key 已启用对该模型的访问权限。
(注: 部分中转站可能需要特定的模型标识符，如 deepseek-chat 而非 DeepSeek-V3)`;
          } else if (response.status === 404) {
            errorMessage = `未找到路径 (404): 请检查代理地址 (Base URL) 是否正确。当前请求地址: ${url}`;
          } else if (response.status === 401) {
            errorMessage = `认证失败 (401): API Key 无效或已过期。`;
          }
        } catch (e) {
          // Fallback
        }
        throw new Error(errorMessage);
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
