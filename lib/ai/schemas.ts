import { z } from 'zod';

export const TestCaseSchema = z.object({
  title: z.string(),
  preconditions: z.string().optional().default(''),
  steps: z.array(z.string()).min(1),
  test_data: z.string().optional().default(''),
  expected_result: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  test_type: z.string().default('functional'),
  needs_verification: z.boolean().default(false),
});

export const TestScenarioSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  test_cases: z.array(TestCaseSchema).min(1),
});

export const TestPlanGenerationSchema = z.object({
  overview: z.string(),
  scope: z.string(),
  out_of_scope: z.string().optional().default(''),
  testing_approach: z.string(),
  scenarios: z.array(TestScenarioSchema).min(1),
  recommended_case_count: z.number().optional(),
  recommendation_reason: z.string().optional(),
});

export type TestPlanGeneration = z.infer<typeof TestPlanGenerationSchema>;
export type TestScenarioGeneration = z.infer<typeof TestScenarioSchema>;
export type TestCaseGeneration = z.infer<typeof TestCaseSchema>;
