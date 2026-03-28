import type { PlanStep, ExecutionPlan, ExecutionPromptOptions } from '../types/index.js';

export function parsePlan(raw: string): ExecutionPlan {
  const deliverableMatch = raw.match(/## Deliverable\s*\n([\s\S]*?)(?=\n## Approach)/i);
  const deliverable = deliverableMatch?.[1]?.trim() ?? '';

  const approachMatch = raw.match(/## Approach\s*\n([\s\S]*?)(?=\n## Steps)/i);
  const approach = approachMatch?.[1]?.trim() ?? '';

  const stepsSection = raw.match(/## Steps\s*\n([\s\S]*)/i)?.[1] ?? '';
  const steps: PlanStep[] = [];
  // Split into chunks on step headers
  const chunks = stepsSection.split(/\n?### (\d+)\.\s*/);
  // chunks: [preamble, num, body, num, body, ...]
  for (let i = 1; i < chunks.length - 1; i += 2) {
    const num = parseInt(chunks[i]);
    const rest = chunks[i + 1];
    // First line is the title, remainder is the description
    const newlineIdx = rest.indexOf('\n');
    const title = newlineIdx === -1 ? rest.trim() : rest.slice(0, newlineIdx).trim();
    let description = newlineIdx === -1 ? '' : rest.slice(newlineIdx + 1);
    // For the last step, strip trailing LLM prose that appears after a blank
    // line which itself follows the step body. Only strip when the description
    // contains exactly one \n\n (single-paragraph body + one trailing section),
    // to avoid cutting multi-paragraph step descriptions.
    if (i + 2 >= chunks.length) {
      const firstBlank = description.indexOf('\n\n');
      const lastBlank = description.lastIndexOf('\n\n');
      if (firstBlank !== -1 && firstBlank === lastBlank) {
        const trailing = description.slice(lastBlank + 2);
        if (/^\S/.test(trailing)) {
          description = description.slice(0, lastBlank);
        }
      }
    }
    steps.push({ number: num, title, description: description.trim() });
  }

  return { deliverable, approach, steps };
}

export function mapStepsToRounds(steps: PlanStep[], maxRounds: number): PlanStep[][] {
  if (maxRounds === 1) return [steps];

  const base = Math.floor(steps.length / maxRounds);
  const remainder = steps.length % maxRounds;
  const assignments: PlanStep[][] = [];

  let offset = 0;
  for (let r = 0; r < maxRounds; r++) {
    const count = base + (r < remainder ? 1 : 0);
    assignments.push(steps.slice(offset, offset + count));
    offset += count;
  }

  return assignments;
}

export function buildPlanningPrompt(
  taskLabel: string,
  modeName: string,
  modeDescription: string,
  maxRounds: number,
): string {
  return `You are about to compete in a battle against another agent.

## Battle Context
- **Mode:** ${modeName} — ${modeDescription}
- **Task:** ${taskLabel}
- **Execution rounds:** ${maxRounds} round(s) available after this planning phase
- **Your role:** Plan your approach strategically. Your plan quality will be evaluated.

## Instructions

Analyze the task and produce a detailed execution plan. Break it down into
concrete, actionable steps that fully cover what needs to be done.

Considerations:
- List steps in logical execution order (each step may depend on prior ones)
- Each step must be self-contained enough to be worked on as a unit
- The plan must cover the ENTIRE task — nothing should be left unaddressed
- Be specific: name the functions, files, patterns, or techniques you will use
- Think about edge cases, testing, and quality — not just the happy path
- Do NOT reference round numbers in your step titles or descriptions — focus on WHAT to do, not WHEN

IMPORTANT: Your plan should describe how to produce the DELIVERABLE that the task
asks for. If the task asks you to write code, your steps should describe how to
build that code. If the task asks you to create a plan, document, or analysis,
your steps should describe how to structure and write that document — do NOT plan to implement what the document describes.

## Output Format

Use this exact structure:

## Deliverable
<One sentence describing what the final output should be: working code, a design
document, an analysis report, a project plan, etc.>

## Approach
<One paragraph summarizing your overall strategy and rationale>

## Steps
### 1. <Step title>
<Detailed description of what to do, how, and what the expected output is>

### 2. <Step title>
<Detailed description>

(continue as needed)`;
}


export function buildExecutionPrompt(opts: ExecutionPromptOptions): string {
  const { taskLabel, plan, assignedSteps, round, maxRounds, previousOutputs } = opts;

  const fullPlanText = formatPlan(plan);

  if (maxRounds === 1) {
    return `You are competing in a battle. Execute your plan completely.

## Your Deliverable
${plan.deliverable || taskLabel}

## Your Plan
${fullPlanText}

## Task
${taskLabel}

## Instructions
Execute ALL steps of your plan. Your output must directly produce the
deliverable described above — the plan is your roadmap, not your output.`;
  }

  const stepsSection = assignedSteps.length > 0
    ? assignedSteps.map(s => `### ${s.number}. ${s.title}\n${s.description}`).join('\n\n')
    : 'No new steps assigned. Review, test, and polish your previous work.';

  const previousSection = previousOutputs
    ? previousOutputs
    : 'This is the first execution round.';

  return `You are competing in a battle. This is round ${round} of ${maxRounds}.

## Your Deliverable
${plan.deliverable || taskLabel}

## Your Full Plan
${fullPlanText}

## This Round's Focus
Execute the following steps:

${stepsSection}

## Previous Work
${previousSection}

## Instructions
Focus on the steps assigned to this round. Build on any previous work.
Your output must directly produce the deliverable described above —
the plan is your roadmap, not your output.`;
}

function formatPlan(plan: ExecutionPlan): string {
  let text = '';
  if (plan.deliverable) text += `## Deliverable\n${plan.deliverable}\n\n`;
  text += `## Approach\n${plan.approach}\n\n## Steps\n`;
  for (const step of plan.steps) {
    text += `### ${step.number}. ${step.title}\n${step.description}\n\n`;
  }
  return text.trimEnd();
}
