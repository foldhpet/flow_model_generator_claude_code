# Flow Model Generator - Claude Code

## Project Purpose

This project demonstrates how to build a **Flow Model generator** for test automation purposes. The Flow Model generator automates the creation of reusable test automation components that follow industry-leading design patterns and architectural principles.

The primary goal is to provide a tool that enables test automation engineers to:
- Efficiently generate Flow Models for test scripts
- Maintain separation of concerns between UI elements and user actions
- Build scalable Test Automation Frameworks (TAF) following the Tri-Layer Testing Architecture

## Core Concepts

### Flow Model Pattern

The Flow Model Pattern is an enhancement of the traditional Page Object Model (POM) that addresses two key limitations:

1. **Single Responsibility Principle**: Traditional Page Object Models often violate SRP by combining element locators with action methods, leading to bloated, hard-to-maintain classes.
2. **Tester's Perspective**: POM has a developer-centric design mindset, whereas the Flow Model Pattern aligns with how test automation engineers naturally think about user interactions.

#### Key Principles:

- **Page Models**: Store only UI elements and their locators
- **Flow Models**: Store user actions performed against elements and combined sequences of user actions (user flows) that accomplish business goals

This separation enables better code reuse, clearer intent in test scripts, and easier maintenance as applications evolve.

**Reference**: https://www.peterfoldhazi.com/flow-model-pattern

### Tri-Layer Testing Architecture

The Tri-Layer Testing Architecture provides a structured blueprint for designing any Test Automation Solution (TAS). It defines three distinct layers, each with specific responsibilities:

#### Layer 1: Core Libraries
Independent, reusable libraries that form the foundation of the framework. These are designed to be tool-agnostic and portable across projects.

**Example libraries:**
- Base Test
- Base Page
- User Action
- Logger
- Reporter

#### Layer 2: Business Logic
Application-specific libraries that implement domain-relevant behavior and use the core libraries.

**Example libraries:**
- Page Model
- Flow Model
- Environment Properties

#### Layer 3: Test Scripts
Runnable test scripts that leverage both business logic and core libraries to validate application behavior.

**Example components:**
- Test Script

#### Key Advantages:

1. **Scalability**: Core libraries can be reused across multiple projects, reducing development time for new TAFs.
2. **Maintainability**: Clear separation of concerns makes the framework easier to update and extend.
3. **Abstraction**: Initial architecture design remains tool-agnostic before concrete tools are selected.
4. **Incremental Build**: Start with the first test, then progressively extract logic into core and business logic layers.

## Development Workflow

When implementing a TAF following this architecture:

1. **Design Phase**: Create an abstract, tool-agnostic Test Automation Architecture
2. **Foundation Phase**: Identify and select core tools (browser automation, test harness, etc.)
3. **Implementation Phase**:
   - Write your first test script
   - Extract reusable logic into business logic layer
   - Promote proven patterns into core libraries
   - Progressively add capabilities as more tests are created

## Project Structure

```
flow_model_generator_claude_code/
├── README.md              # Project overview
├── CLAUDE.md              # This file
└── docs/
    ├── FLOW-MODEL.md      # Flow Model Pattern documentation
    └── TRI-LAYER.md       # Tri-Layer Architecture documentation
```

## Collaboration Notes

When working with this codebase:
- Reference the Flow Model Pattern documentation when designing new Flow Models
- Ensure all components align with the Tri-Layer Architecture
- Prioritize code generation tools that respect the separation between Page Models and Flow Models
- Keep core libraries portable and tool-independent
