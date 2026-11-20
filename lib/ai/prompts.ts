const QA_SYSTEM_RULES = `You are a senior QA engineer generating manual test artifacts.

Rules you must follow:
1. Distinguish between OBSERVED facts (stated directly in the requirement), DERIVED conclusions
   (logically inferred from the requirement), and ASSUMED details (not verified anywhere in the
   input). Set "needs_verification": true on any test case that relies on an assumed detail
   (e.g. a specific character limit, a specific error message wording) not explicitly stated
   in the requirement.
2. Apply standard test design techniques where relevant: equivalence partitioning, boundary
   value analysis, decision tables, state transition testing, and error guessing. Do not name
   these techniques in the output - just apply them to produce good coverage.
3. Include both positive and negative test cases. Cover empty inputs, boundary values, and
   invalid states where applicable.
4. Never invent application behavior you have no basis for. If the requirement doesn't specify
   an exact validation rule, mark that case as needing verification rather than guessing a
   specific number or message.
5. Output ONLY valid JSON matching the exact schema requested. No markdown fences, no preamble,
   no explanation text outside the JSON.`;

export function buildTestPlanPrompt(params: {
  projectName: string;
  requirementText: string;
  requestedCaseCount?: number;
}) {
  const { projectName, requirementText, requestedCaseCount } = params;

  const countInstruction = requestedCaseCount
    ? `The user requested approximately ${requestedCaseCount} test cases total. If you believe
       significantly more are needed for adequate coverage, still generate what's needed and
       set "recommended_case_count" and "recommendation_reason" to explain why.`
    : `Generate comprehensive coverage. Set "recommended_case_count" to the total number of
       test cases you generated and briefly explain the reasoning in "recommendation_reason".`;

  return `${QA_SYSTEM_RULES}

Project: ${projectName}

Requirement:
"""
${requirementText}
"""

Task: Generate a test plan with test scenarios and test cases covering this requirement.
${countInstruction}

Output JSON matching this shape exactly:
{
  "overview": string,
  "scope": string,
  "out_of_scope": string,
  "testing_approach": string,
  "recommended_case_count": number,
  "recommendation_reason": string,
  "scenarios": [
    {
      "title": string,
      "description": string,
      "priority": "low" | "medium" | "high" | "critical",
      "test_cases": [
        {
          "title": string,
          "preconditions": string,
          "steps": string[],
          "test_data": string,
          "expected_result": string,
          "priority": "low" | "medium" | "high" | "critical",
          "severity": "low" | "medium" | "high" | "critical",
          "test_type": string,
          "needs_verification": boolean
        }
      ]
    }
  ]
}`;
}
