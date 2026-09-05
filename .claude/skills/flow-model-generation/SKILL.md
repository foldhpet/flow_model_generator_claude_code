---
name: flow-model-generation
description: Analyze test cases or test automation scripts to generate flow models, page models, and flow model diagrams
---

# Flow Model Generation Skill

## Role

The Flow Model Generation Skill helps you efficiently generate and maintain the reusable components of your Test Automation Framework (TAF) using the Flow Model Pattern.

**Generation:** The skill analyzes test cases, test automation scripts, and user stories to generate flow models, page models, diagrams, and comprehensive documentation. It extracts user workflows from test specifications and translates them into maintainable, composable code that separates concerns between page interactions (Page Models) and user actions/workflows (Flow Models).

**Maintenance:** The skill also helps you keep your framework up-to-date by identifying and updating existing flows and page models when requirements change, removing obsolete models that are no longer needed, identifying duplicate or functionally similar flows and page models, consolidating duplicates to improve reusability and reduce maintenance overhead, and ensuring updates and cleanups happen smoothly and efficiently. It validates that generated code remains aligned with your test specifications and identifies opportunities to improve reusability.

## Test Case Definition and Test Script Code
Test Case Definition is a structured description of a test scenario, including its preconditions, steps, expected results, and acceptance criteria. Test scripts are the actual code implementations of these test cases, often written in programming languages like TypeScript or Python.

## What It Does

1. **Analyzes Test Files** — Reads selected test cases or test script files to understand user workflows
2. **Updates Documentation** — Creates or updates flow diagrams in `src/business/docs/FLOW_MODELS_DESIGN.md`
3. **Generates Flow Models** — Creates or updates flow model classes in `src/business/flows/`
4. **Generates Page Models** — Creates or updates page model classes in `src/business/pages/`

## Process

### Step 1: Analyze Test & Identify Flow Models
- Read the selected test file(s)
- Identify the test scenario and user workflow
- Determine if existing flow models can be reused or if new ones are needed
- Identify page interactions and whether new page models are required

### Step 2: Update FLOW_MODELS_DESIGN.md
- Add or update the flow diagram showing the user journey
- Include step-by-step flow visualization (ASCII art)
- Document which test(s) use this flow
- Link to corresponding flow model and page model classes

### Step 3: Create or Update Flow Models
- Create flow model files in `src/business/flows/` directory
- Follow naming convention: `{flow-name}.flow.ts`
- Each flow model should:
  - Orchestrate page interactions into cohesive workflows
  - Have clear, single-purpose methods for each step
  - Delegate to sub-flows where appropriate
  - Include comprehensive console logging with emoji indicators
  - Have proper error handling

### Step 4: Create or Update Page Models
- Create page model files in `src/business/pages/` directory
- Follow naming convention: `{page-name}.page.ts`
- Each page model should:
  - Encapsulate selectors and interactions for a specific page
  - Have methods for each user action (click, fill, select, etc.)
  - Have getters for page validation (isVisible, hasError, etc.)
  - Include proper waits and error handling

## Usage

Ask Claude Code directly:

```
Generate flow models for: tests/my-test.spec.ts
```

Or by test name pattern:

```
Generate flow models for test: 'open base page and retrieve page title'
```

## Output

The skill will:
1. Display analysis of the test and identified flows
2. Show the updated flow diagram(s)
3. List created/modified files
4. Provide implementation summary
