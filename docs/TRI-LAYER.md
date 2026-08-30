# Tri-Layer Testing Architecture

## Description
The Tri-Layer Testing Architecture provides a simplified aproach to designing the blueprint for any TAS (Test Automation Solution). As the name hints, there are three layers defined in this concept:
- Test Scripts (runnable test scripts)
- Business Logic (all the application specific libraries)
- Core Libraries (independent, reusable libraries)

The main idea is that the core libraries enable software engineers to scale a TAF (Test Automation Framework) to additional projects by reusing core libraries when building new TAFs. The business logic and test scripts layers will be then created specifically for the new application under test.

## Designining the Test Automation Architecture
The TAA (Test Automation Architecture) design initially should be tool agnostic and abstract. As you progress with identifying the base tools, such as the browser automation tool, or the test harness, you start building up the core of the framework.

## Implementing the Test Automation Framework
When starting the implementation, create your first test, then start moving out logic to the core libraries and business logic. The more tests you create, the more libraries you can build, adding more capabilities to your TAF.

## Example libraries found in each layer

### Core Libraries
- Base Test
- Base Page
- User Action
- Logger
- Reporter

### Business Logic
- Page Model
- Flow Model
- Environment Properties

Test Scripts
- Test Script