'use server';

import { getSession } from '@/modules/auth/session';
import { getDB, getKV } from '@/db/client';
import { hasPermission } from '@/modules/roles/rbac';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const CACHE_TTL_SECONDS = 300; // 5 minutes cache for AI prompts
const MAX_CONTEXT_LENGTH = 3000; // max characters sent as context to save token budget

interface TaskContext {
  title: string;
  description: string | null;
  status: string;
  project_name: string;
  deadline: number | null;
}

interface ProjectContext {
  name: string;
  description: string | null;
  status: string;
  deadline: number | null;
}

interface KBContext {
  title: string;
  category: string;
  content: string;
}

/**
 * MD5-like string hashing function for prompt caching.
 */
async function getPromptHash(prompt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(prompt.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Server Action to query KIAN HQ AI Assistant.
 * Implements:
 * 1. Intent Engine (keyword detection)
 * 2. Context Builder (D1 relational metadata parsing)
 * 3. Token Budget Engine (caching & truncation)
 * 4. AI Router (Cloudflare Workers AI Llama-3)
 */
export async function askAIAssistant(prompt: string) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  if (!prompt || prompt.trim() === '') {
    return { success: false, error: 'Prompt is required.' };
  }

  const db = await getDB();
  const kv = await getKV();

  try {
    // ---- 1. CACHE CHECK (Token Budget Engine) ----
    const promptHash = await getPromptHash(prompt);
    const cacheKey = `ai:cache:${session.userId}:${promptHash}`;
    const cachedResponse = await kv.get(cacheKey);

    if (cachedResponse) {
      return { success: true, answer: cachedResponse, cached: true };
    }

    // ---- 2. INTENT ENGINE (Business Logic First) ----
    const lowerPrompt = prompt.toLowerCase();
    let intent: 'TASK_QUERY' | 'PROJECT_QUERY' | 'KB_QUERY' | 'GENERAL' = 'GENERAL';

    if (
      lowerPrompt.includes('tugas') ||
      lowerPrompt.includes('task') ||
      lowerPrompt.includes('kerjaan') ||
      lowerPrompt.includes('todo')
    ) {
      intent = 'TASK_QUERY';
    } else if (
      lowerPrompt.includes('proyek') ||
      lowerPrompt.includes('project') ||
      lowerPrompt.includes('kampanye')
    ) {
      intent = 'PROJECT_QUERY';
    } else if (
      lowerPrompt.includes('guideline') ||
      lowerPrompt.includes('aturan') ||
      lowerPrompt.includes('kb') ||
      lowerPrompt.includes('dokumen') ||
      lowerPrompt.includes('brief')
    ) {
      intent = 'KB_QUERY';
    }

    // ---- 3. CONTEXT BUILDER ----
    let contextStr = 'No specific database context fetched.';

    if (intent === 'TASK_QUERY') {
      const query = `
        SELECT t.title, t.description, t.status, p.name as project_name, t.deadline
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.assigned_to = ? OR t.created_by = ?
        LIMIT 10
      `;
      const { results: tasks } = await db.prepare(query).bind(session.userId, session.userId).all();
      const taskList = tasks as unknown as TaskContext[];
      contextStr = `User Tasks:\n` + taskList
        .map(
          (t) =>
            `- [${t.project_name}] Task: ${t.title} (${t.status})${
              t.deadline ? `, Due: ${new Date(t.deadline).toLocaleDateString()}` : ''
            }`
        )
        .join('\n');
    } else if (intent === 'PROJECT_QUERY') {
      const { results: projectsRaw } = await db
        .prepare('SELECT name, description, status, deadline FROM projects LIMIT 10')
        .all();
      const projects = projectsRaw as unknown as ProjectContext[];
      contextStr = `Active Projects:\n` + projects
        .map(
          (p) =>
            `- Project: ${p.name} (Status: ${p.status})${
              p.deadline ? `, Due: ${new Date(p.deadline).toLocaleDateString()}` : ''
            }`
        )
        .join('\n');
    } else if (intent === 'KB_QUERY') {
      const { results: kbRaw } = await db.prepare('SELECT title, category, content FROM knowledge_base LIMIT 5').all();
      const kbList = kbRaw as unknown as KBContext[];
      contextStr = `Knowledge Base Documentation:\n` + kbList
        .map((k) => `- Category: ${k.category}, Title: ${k.title}\n  Content: ${k.content.substring(0, 300)}...`)
        .join('\n');
    }

    // Truncate context if it exceeds budget limits
    if (contextStr.length > MAX_CONTEXT_LENGTH) {
      contextStr = contextStr.substring(0, MAX_CONTEXT_LENGTH) + '\n... [Context truncated to fit token budget]';
    }

    // Fetch user role for prompt personalization
    const roleResult = await db
      .prepare('SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?')
      .bind(session.userId)
      .first() as { name: string } | null;
    const userRole = roleResult?.name || 'CREATOR';

    // ---- 4. AI ROUTER & PROVIDER ----
    // Retrieve Cloudflare Workers AI binding
    const { env: cfEnv } = await getCloudflareContext();
    const model = '@cf/meta/llama-3-8b-instruct';

    const systemPrompt = `
You are the KIAN HQ AI Assistant, a helpful and direct creative team assistant for KIAN HQ OS.
Answer the user's question concisely in Indonesian, based ONLY on the provided system context.
If the context doesn't contain the answer, say "Saya tidak menemukan data tersebut di database KIAN HQ."
Do not invent any details. Always prioritize business logic context.

User Profile:
- Name: ${session.name}
- Email: ${session.email}
- Security Clearance Role: ${userRole}

Current Date: ${new Date().toLocaleDateString()}

System Context Database Info:
"""
${contextStr}
"""
`;

    // Invoke Cloudflare Workers AI Llama model
    const aiResponse = await cfEnv.AI.run(model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }) as { response: string };

    const answer = aiResponse.response || 'Maaf, saya tidak dapat merespons saat ini.';

    // ---- 5. CACHE RESPONSE (Token Budget Engine) ----
    try {
      await kv.put(cacheKey, answer, { expirationTtl: CACHE_TTL_SECONDS });
    } catch (cacheErr) {
      console.error('Failed to cache AI response in KV:', cacheErr);
    }

    // ---- 6. LOG TO D1 ----
    try {
      const logId = `log_${crypto.randomUUID().replace(/-/g, '')}`;
      // Estimate token use roughly since prompt length is small (1 word ~ 1.3 tokens)
      const estimatedTokens = Math.ceil((systemPrompt.length + prompt.length + answer.length) / 4);
      await db
        .prepare('INSERT INTO ai_token_logs (id, user_id, intent_detected, tokens_used, model_used) VALUES (?, ?, ?, ?, ?)')
        .bind(logId, session.userId, intent, estimatedTokens, model)
        .run();
    } catch (logErr) {
      console.error('Failed to log AI token usage to D1:', logErr);
    }

    return { success: true, answer, cached: false };
  } catch (error: any) {
    console.error('askAIAssistant failed:', error);
    return { success: false, error: error.message || 'AI processing failed.' };
  }
}
