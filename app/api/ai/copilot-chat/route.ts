import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/orchestrator';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { projectId, messages } = await req.json();

  if (!projectId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'projectId and messages are required' }, { status: 400 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Pull recent project context so the copilot isn't answering blind
  const { data: recentPlans } = await supabase
    .from('test_plans')
    .select('content_json, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(3);

  const { count: totalCases } = await supabase
    .from('test_cases')
    .select('id', { count: 'exact', head: true });

  const contextSummary = recentPlans?.length
    ? recentPlans.map((p, i) => `Plan ${i + 1} overview: ${p.content_json?.overview || 'N/A'}`).join('\n')
    : 'No test plans generated yet in this project.';

  const conversationText = messages
    .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const prompt = `You are an AI QA Copilot embedded in a test management tool. Be concise and practical -
this is a chat sidebar, not a report. Answer in a few sentences unless the user asks for a list.

Project: ${project.name}

Recent project context:
${contextSummary}

Conversation so far:
${conversationText}

Reply to the last user message. If they ask you to generate test cases, explain briefly what
you'd generate and suggest they use the main "Generate Test Plan" panel with that requirement
text, since actual generation happens there (with review/approval), not directly in chat.`;

  let result;
  try {
    result = await generateText({
      taskType: 'copilot_chat',
      prompt,
      maxTokens: 1000,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'AI request failed' }, { status: 502 });
  }

  const admin = createAdminClient();
  await admin.from('ai_usage_log').insert({
    project_id: projectId,
    task_type: 'copilot_chat',
    model_used: `${result.provider}/${result.modelUsed}`,
    tokens_used: result.tokensUsed,
  });

  return NextResponse.json({ reply: result.text });
}
