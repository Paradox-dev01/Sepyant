import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateText } from '@/lib/ai/orchestrator';
import { DEV_BYPASS, buildMockCopilotReply, getDevProject } from '@/lib/dev-bypass';
import { loadDevStoreOnce } from '@/lib/dev-store-persistence';

export async function POST(req: NextRequest) {
  // ===== [FRONTEND-FIRST DEV BYPASS] — dev-only simulated reply =====
  // No auth check, no DB reads, no AI call. Clearly labeled via devMock:true
  // and the "[DEV MOCK]" prefix. Remove NEXT_PUBLIC_DEV_BYPASS_AUTH from
  // .env.local to restore the real flow below.
  if (DEV_BYPASS) {
    let body: { projectId?: string; messages?: { role: string; content: string }[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { projectId, messages } = body || {};
    if (!projectId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'projectId and messages are required' }, { status: 400 });
    }
    loadDevStoreOnce();
    const devProject = getDevProject(projectId);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    return NextResponse.json({
      reply: buildMockCopilotReply(devProject?.name, lastUser),
      devMock: true,
    });
  }
  // ===== end dev bypass =====

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

Reply to the last user message. [PHASE 1] If the user asks you to generate test cases or a test
plan, briefly explain what you'd generate and tell them to switch the chat toggle (below the
message box) to "Generate" mode and paste the requirement there — actual generation with
review/approval happens in Generate mode, not in Ask mode.`;

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
