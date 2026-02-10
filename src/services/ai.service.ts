// AI Service for converting natural language to MongoDB queries and general chat
// Supports: DeepSeek, OpenAI GPT, Anthropic Claude, Groq, Mistral, xAI Grok, OpenRouter, Ollama, Google Gemini, Custom providers

import type { AIModel } from '@/store/aiSettingsStore'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const AI_CONFIGS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-large-latest',
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-2-latest',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'auto',
  },
  ollama: {
    url: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3.2',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash',
    model: 'gemini-2.0-flash',
  },
  custom: {
    url: '',
    model: '',
  },
}

export interface NaturalLanguageQueryRequest {
  query: string
  collectionSchema?: any // Optional: provide sample document for better context
  availableFields?: string[] // Optional: list of available field names in the collection
}

export interface NaturalLanguageQueryResponse {
  success: boolean
  mongoQuery?: any
  options?: {
    limit?: number
    skip?: number
    sort?: any
  }
  explanation?: string
  error?: string
}

class AIService {
  getConfig(model: AIModel) {
    if (model.provider === 'custom' || model.provider === 'ollama') {
      const defaults = AI_CONFIGS[model.provider]
      return {
        url: model.apiUrl || defaults.url,
        model: model.modelName || defaults.model,
      }
    }
    return AI_CONFIGS[model.provider]
  }

  async convertNaturalLanguageToQuery(
    request: NaturalLanguageQueryRequest,
    model: AIModel
  ): Promise<NaturalLanguageQueryResponse> {
    if (!model) {
      return {
        success: false,
        error: 'No AI model selected. Please configure AI models in settings.',
      }
    }

    const apiKey = model.apiKey
    const provider = model.provider

    if (!apiKey) {
      return {
        success: false,
        error: `API key not configured for ${model.name}. Please update it in settings.`,
      }
    }

    try {
      const systemPrompt = `You are a MongoDB query expert. Convert natural language queries to MongoDB query objects with options.

Rules:
1. Return ONLY valid JSON object with "filter" and "options" fields
2. "filter" contains MongoDB query operators: $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or, $not, $regex, etc.
3. "options" can contain: limit (number), skip (number), sort (object)
4. For text search, use $regex with case-insensitive flag
5. Return empty filter {} for "all documents" or "show all"
6. Do not include any markdown, code blocks, or extra text - ONLY the JSON object
7. IMPORTANT: Use ONLY the field names provided in the available fields list. Do not guess or invent field names.

Examples:
Input: "find users with age greater than 25"
Output: {"filter": {"age": {"$gt": 25}}, "options": {}}

Input: "find users named John"
Output: {"filter": {"name": "John"}, "options": {}}

Input: "find users with email containing gmail"
Output: {"filter": {"email": {"$regex": "gmail", "$options": "i"}}, "options": {}}

Input: "find users created after 2023-01-01"
Output: {"filter": {"createdAt": {"$gt": "2023-01-01"}}, "options": {}}

Input: "show all users limit 10"
Output: {"filter": {}, "options": {"limit": 10}}

Input: "find users with age > 25 and limit 5"
Output: {"filter": {"age": {"$gt": 25}}, "options": {"limit": 5}}

Input: "find users sorted by name ascending"
Output: {"filter": {}, "options": {"sort": {"name": 1}}}

Input: "find users with role admin sorted by createdAt descending limit 20"
Output: {"filter": {"role": "admin"}, "options": {"sort": {"createdAt": -1}, "limit": 20}}

Input: "show all"
Output: {"filter": {}, "options": {}}`

      let userPrompt = ''

      // Add available fields if provided
      if (request.availableFields && request.availableFields.length > 0) {
        userPrompt += `Available fields in this collection: ${request.availableFields.join(', ')}\n\n`
      }

      // Add schema example if provided
      if (request.collectionSchema) {
        userPrompt += `Collection schema example:\n${JSON.stringify(request.collectionSchema, null, 2)}\n\n`
      }

      userPrompt += `Query: ${request.query}`

      let aiResponse: string

      if (provider === 'gemini') {
        // Google Gemini API format
        aiResponse = await this.callGeminiAPI(systemPrompt, userPrompt, apiKey, model)
      } else if (provider === 'anthropic') {
        // Anthropic Claude API format (different from OpenAI)
        aiResponse = await this.callAnthropicAPI(systemPrompt, userPrompt, apiKey, model)
      } else {
        // OpenAI-compatible format (DeepSeek, OpenAI, Groq, Mistral, xAI, OpenRouter, Ollama, Custom)
        aiResponse = await this.callOpenAICompatibleAPI(systemPrompt, userPrompt, apiKey, model)
      }

      if (!aiResponse) {
        throw new Error('Empty response from AI')
      }

      // Try to parse the response as JSON
      let parsedResponse: any
      try {
        // Remove markdown code blocks if present
        const cleanedResponse = aiResponse
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()

        parsedResponse = JSON.parse(cleanedResponse)
      } catch (parseError) {
        throw new Error(`Failed to parse AI response as JSON: ${aiResponse}`)
      }

      // Extract filter and options
      const mongoQuery = parsedResponse.filter || parsedResponse
      const options = parsedResponse.options || {}

      return {
        success: true,
        mongoQuery,
        options,
        explanation: `Converted "${request.query}" to MongoDB query using ${model.name}`,
      }
    } catch (error: any) {
      console.error('AI query conversion error:', error)
      return {
        success: false,
        error: error.message || 'Failed to convert query',
      }
    }
  }

  private async callOpenAICompatibleAPI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    model: AIModel
  ): Promise<string> {
    const config = this.getConfig(model)

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
  }

  private async callGeminiAPI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    model: AIModel
  ): Promise<string> {
    const config = this.getConfig(model)
    const url = `${config.url}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt + '\n\n' + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }

  private async callAnthropicAPI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    model: AIModel
  ): Promise<string> {
    const config = this.getConfig(model)

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content?.[0]?.text?.trim() || ''
  }

  /**
   * Stream a chat response from the AI model.
   * Calls onChunk with each text chunk as it arrives.
   * Returns the full response text when done.
   */
  async chatStream(
    messages: ChatMessage[],
    model: AIModel,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (!model?.apiKey) {
      throw new Error('No AI model configured. Please add one in Settings → AI Models.')
    }

    const config = this.getConfig(model)

    if (model.provider === 'gemini') {
      // Gemini streaming via streamGenerateContent with SSE
      return this.chatGeminiStream(messages, model, onChunk, signal)
    }

    if (model.provider === 'anthropic') {
      // Anthropic streaming uses different SSE format
      return this.chatAnthropicStream(messages, model, onChunk, signal)
    }

    // OpenAI-compatible streaming (DeepSeek, OpenAI, Groq, Mistral, xAI, OpenRouter, Ollama, Custom)
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullText += content
            onChunk(content)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return fullText
  }

  private async chatGeminiStream(
    messages: ChatMessage[],
    model: AIModel,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const config = this.getConfig(model)
    // Use streamGenerateContent endpoint with alt=sse for SSE streaming
    const url = `${config.url}:streamGenerateContent?alt=sse&key=${model.apiKey}`

    // Convert messages to Gemini format
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    }

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)

        try {
          const parsed = JSON.parse(data)
          // Gemini SSE: candidates[].content.parts[].text
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            fullText += text
            onChunk(text)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return fullText
  }

  private async chatAnthropicStream(
    messages: ChatMessage[],
    model: AIModel,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const config = this.getConfig(model)

    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        system: systemMsg?.content || '',
        messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: 4096,
        temperature: 0.7,
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)

        try {
          const parsed = JSON.parse(data)
          // Anthropic SSE: content_block_delta events contain text
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text
            onChunk(parsed.delta.text)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    return fullText
  }
}

export const aiService = new AIService()

