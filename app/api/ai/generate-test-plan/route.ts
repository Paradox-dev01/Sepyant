import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateStructured } from '@/lib/ai/orchestrator';
import { buildTestPlanPrompt } from '@/lib/ai/prompts';
import { TestPlanGenerationSchema } from '@/lib/ai/schemas';

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: 'Failed to save test plan' }, { status: 500 });
  }

  // 4. Save scenarios + test cases
  const savedScenarios = [];
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

    if (scenarioError || !savedScenario) continue;

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

    const { data: savedCases } = await supabase
      .from('test_cases')
      .insert(casesToInsert)
      .select();

    savedScenarios.push({ ...savedScenario, test_cases: savedCases || [] });
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
