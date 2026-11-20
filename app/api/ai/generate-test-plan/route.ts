import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateStructured } from '@/lib/ai/orchestrator';
import { buildTestPlanPrompt } from '@/lib/ai/prompts';
import { TestPlanGenerationSchema } from '@/lib/ai/schemas';
import { DEV_BYPASS, buildMockGeneration, getDevProject } from '@/lib/dev-bypass';
import { loadDevStoreOnce, saveDevStore } from '@/lib/dev-store-persistence';

export async function POST(req: NextRequest) {
  // ===== [FRONTEND-FIRST DEV BYPASS] — dev-only simulated response =====
  // No auth check, no DB writes, no AI call. The response is clearly labeled
  // via devMock:true, "[DEV MOCK]" strings, and the sidebar DEV badge. Remove
  // NEXT_PUBLIC_DEV_BYPASS_AUTH from .env.local to restore the real flow
  // below (auth -> validate -> DB -> AI -> persist).
  if (DEV_BYPASS) {
    let body: { projectId?: string; requirementText?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { projectId, requirementText } = body || {};
    if (!projectId || !requirementText?.trim()) {
      return NextResponse.json(
        { error: 'projectId and requirementText are required' },
        { status: 400 }
      );
    }
    loadDevStoreOnce();
    const devProject = getDevProject(projectId);
    if (!devProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const mockResponse = buildMockGeneration(projectId, devProject.name, requirementText);
    // [DEV MOCK PERSISTENCE] buildMockGeneration stored the new plan in the
    // mock store — snapshot it so restarts keep the full demo history.
    saveDevStore();
    return NextResponse.json(mockResponse);
  }
  // ===== end dev bypass =====

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, requirementText, requestedCaseCount } = body as {
    projectId: string;
    requirementText: string;
    requestedCaseCount?: number;
  };

  if (!projectId || !requirementText?.trim()) {
    return NextResponse.json(
      { error: 'projectId and requirementText are required' },
      { status: 400 }
    );
  }

  // Verify the project belongs to this user (RLS also enforces this, this is a fast-fail check)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // 1. Save the requirement
  const { data: requirement, error: reqError } = await supabase
    .from('requirements')
    .insert({
      project_id: projectId,
      source_type: 'text',
      raw_content: requirementText,
    })
    .select()
    .single();

  if (reqError || !requirement) {
    return NextResponse.json({ error: 'Failed to save requirement' }, { status: 500 });
  }

  // 2. Call the AI orchestrator
  let result;
  try {
    result = await generateStructured({
      taskType: 'test_plan_generation',
      prompt: buildTestPlanPrompt({
        projectName: project.name,
        requirementText,
        requestedCaseCount,
      }),
      schema: TestPlanGenerationSchema,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'AI generation failed' },
      { status: 502 }
    );
  }

  const generated = result.data;

  // 3. Save test plan
  const { data: testPlan, error: planError } = await supabase
    .from('test_plans')
    .insert({
      project_id: projectId,
      requirement_id: requirement.id,
      content_json: {
        overview: generated.overview,
        scope: generated.scope,
        out_of_scope: generated.out_of_scope,
        testing_approach: generated.testing_approach,
        recommended_case_count: generated.recommended_case_count,
        recommendation_reason: generated.recommendation_reason,
      },
    })
    .select()
    .single();

  if (planError || !testPlan) {
    // [PHASE 1] roll back the requirement saved in step 1 so no orphan rows
    // are left behind when the plan insert fails.
    const delReq = await supabase.from('requirements').delete().eq('id', requirement.id);
    if (delReq.error) {
      console.error('[sepyant] requirement rollback failed:', delReq.error.message, '(ref:', requirement.id, ')');
    }
    return NextResponse.json(
      { error: `Failed to save test plan: ${planError?.message || 'unknown error'}. The partial generation was rolled back — nothing was saved.` },
      { status: 500 }
    );
  }

  // 4. Save scenarios + test cases.
  // [PHASE 1] Failed writes are no longer silently skipped. Supabase has no
  // client-side transactions, so on any failure we compensate manually: the
  // plan delete cascades to scenarios/cases (FK ON DELETE CASCADE), the
  // requirement delete removes the orphaned requirement row, and the client
  // receives a visible 500 instead of a half-saved generation round.
  const savedScenarios: { id: string; title: string; description: string; priority: string; test_cases: any[] }[] = [];
  let writeError: string | null = null;

  for (const scenario of generated.scenarios) {
    const { data: savedScenario, error: scenarioError } = await supabase
      .from('test_scenarios')
      .insert({
        test_plan_id: testPlan.id,
        title: scenario.title,
        description: scenario.description,
        priority: scenario.priority,
      })
      .select()
      .single();

    if (scenarioError || !savedScenario) {
      writeError = `Failed to save test scenario "${scenario.title}": ${scenarioError?.message || 'unknown error'}`;
      break;
    }

    const casesToInsert = scenario.test_cases.map((tc) => ({
      test_scenario_id: savedScenario.id,
      title: tc.title,
      preconditions: tc.preconditions,
      steps_json: tc.steps,
      test_data: tc.test_data,
      expected_result: tc.expected_result,
      priority: tc.priority,
      severity: tc.severity,
      test_type: tc.test_type,
      ai_generated: true,
      approved: false,
      needs_verification: tc.needs_verification,
    }));

    const { data: savedCases, error: casesError } = await supabase
      .from('test_cases')
      .insert(casesToInsert)
      .select();

    if (casesError || !savedCases) {
      writeError = `Failed to save test cases for scenario "${scenario.title}": ${casesError?.message || 'unknown error'}`;
      break;
    }

    savedScenarios.push({ ...savedScenario, test_cases: savedCases });
  }

  if (writeError) {
    // Roll back the partial round. Failure of the rollback itself is logged
    // loudly — orphan rows would need manual cleanup in that unlikely case.
    const delPlan = await supabase.from('test_plans').delete().eq('id', testPlan.id);
    const delReq = await supabase.from('requirements').delete().eq('id', requirement.id);
    if (delPlan.error || delReq.error) {
      console.error(
        '[sepyant] generation rollback failed — orphaned rows may exist:',
        JSON.stringify({ plan: delPlan.error?.message, requirement: delReq.error?.message, testPlanId: testPlan.id, requirementId: requirement.id })
      );
      return NextResponse.json(
        { error: `${writeError} Automatic cleanup also failed (ref: plan ${testPlan.id}); please contact an administrator.` },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: `${writeError} The partial generation was rolled back — nothing was saved.` }, { status: 500 });
  }

  // 5. Log AI usage (admin client - bypasses RLS, this is a trusted server-side write)
  const admin = createAdminClient();
  await admin.from('ai_usage_log').insert({
    project_id: projectId,
    task_type: 'test_plan_generation',
    model_used: `${result.provider}/${result.modelUsed}`,
    tokens_used: result.tokensUsed,
  });

  return NextResponse.json({
    testPlan,
    scenarios: savedScenarios,
    recommendedCaseCount: generated.recommended_case_count,
    recommendationReason: generated.recommendation_reason,
  });
}
