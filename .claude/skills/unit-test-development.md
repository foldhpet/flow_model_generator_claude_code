---
name: unit-test-development
description: Analyze application code and suggest comprehensive unit tests using white-box testing techniques
---

# Unit Test Development Skill

## Purpose

This skill analyzes generated application code and suggests unit tests to be created, ensuring thorough coverage of each method within a class file using white-box testing techniques such as branch testing and decision coverage.

## When to Use

Invoke this skill when you need to:
- Analyze application code (classes, methods, functions) and suggest unit test cases
- Ensure comprehensive code coverage using white-box testing techniques
- Generate unit tests for specific files or code modules
- Validate that critical paths and edge cases are covered
- Create test cases that follow industry best practices for unit testing

## Trigger Keywords

- "suggest unit tests"
- "generate unit tests"
- "unit test coverage"
- "white-box testing"
- "branch coverage"
- "decision coverage"
- "test this code"
- "create tests for this method"
- "unit test analysis"

## How It Works

The skill will:

1. **Code Analysis Phase**
   - Analyze the provided source code (class/method level)
   - Identify all methods, functions, and code paths
   - Map decision points, branches, loops, and conditional logic
   - Identify boundary conditions and edge cases
   - Flag complex logic that requires thorough testing

2. **Test Planning Phase**
   - Determine appropriate white-box testing techniques for each method
   - Map code paths to test scenarios
   - Identify positive and negative test cases
   - Define boundary value tests
   - Plan equivalence partitioning where applicable

3. **Test Case Generation Phase**
   - Create detailed test cases for each method
   - Specify test data and expected outcomes
   - Map each test to the code paths it covers
   - Ensure branch/decision coverage is comprehensive
   - Provide implementation hints and test patterns

4. **Coverage Validation Phase**
   - Verify all branches and decision paths are covered
   - Identify any gaps in coverage
   - Suggest additional tests for uncovered paths
   - Provide coverage statistics

5. **Documentation Phase**
   - Generate test documentation with clear test IDs
   - Include test objectives aligned with code analysis
   - Document test data setup requirements
   - Provide assertion guidelines

## Input Requirements

The skill expects one of the following inputs:

1. **Source Code File Path** - Path to a source code file containing classes/methods
   ```
   Analyze unit tests for: src/services/PaymentService.ts
   ```

2. **Inline Code Block** - Code pasted directly in the request
   ```
   ```csharp
   public class Calculator {
       public int Add(int a, int b) { return a + b; }
       public int Divide(int a, int b) { return a / b; }
   }
   ```
   ```

3. **Code Selection** - Specific method or class to analyze
   ```
   Generate unit tests for the ValidateEmail method in UserValidator class
   ```

4. **Project Reference** - Reference to a specific component
   ```
   Create unit tests for all public methods in the AuthenticationService
   ```

## White-Box Testing Techniques Applied

### 1. Branch Coverage
- Identify all branches (if/else, switch statements)
- Create test cases that execute each branch
- Ensure both true and false paths are tested
- Test all switch/case combinations

### 2. Decision Coverage (Condition Coverage)
- Identify all decision points and boolean expressions
- Test conditions that evaluate to true and false
- Test combinations of boolean operators (AND, OR, NOT)
- Verify all logical operators are properly evaluated

### 3. Path Coverage
- Identify all independent paths through the code
- Create test cases for each path combination
- Focus on critical and complex paths first
- Document path descriptions and dependencies

### 4. Boundary Value Analysis
- Identify boundary conditions for inputs
- Test at boundaries (min, max, just inside/outside)
- Include off-by-one error tests
- Test NULL, empty string, empty collection boundaries

### 5. Equivalence Partitioning
- Divide input domain into equivalence classes
- Select one test case from each class
- Test both valid and invalid partitions
- Ensure minimal yet comprehensive test coverage

### 6. Loop Testing
- Test loop boundaries (zero iterations, one, multiple)
- Test loop control variables
- Test loop termination conditions
- Test scenarios where loop is never entered

### 7. Exception Path Testing
- Identify all try-catch blocks
- Create tests that trigger each exception
- Test exception handling logic
- Verify error messages and recovery paths

## Output Format

The skill generates output with the following structure:

### Test Analysis Summary
```
Code File: [Filename]
Total Methods: [Count]
Complexity Assessment: [Low/Medium/High]
Estimated Test Cases Needed: [Count]
Coverage Target: [Branch/Decision/Path coverage percentage]
```

### Test Case Specification Format

For each method analyzed:

**Method:** `[MethodSignature]`

**Complexity:** [Simple/Moderate/Complex]

**Test Objectives:**
- Objective 1: [What should be tested]
- Objective 2: [What should be tested]

**Test Cases:**

| Test ID | Test Case Name | Test Data/Input | Expected Output | Code Path Covered | Technique |
|---|---|---|---|---|---|
| TC-1.1 | [Descriptive name] | Input: [...], Setup: [...] | Expected result: [...] | [Branch/Path description] | [Technique used] |
| TC-1.2 | [Descriptive name] | Input: [...], Setup: [...] | Expected result: [...] | [Branch/Path description] | [Technique used] |

**Branch Coverage Analysis:**
- Branch 1 (if condition true): Covered by TC-1.1
- Branch 2 (if condition false): Covered by TC-1.2
- Coverage: 100%

**Edge Cases & Boundary Values:**
- Test case for null input: TC-1.3
- Test case for empty collection: TC-1.4
- Test case for maximum value: TC-1.5
- Test case for minimum value: TC-1.6

**Exception Scenarios:**
- Exception 1: Covered by TC-1.7
- Exception 2: Covered by TC-1.8

### Test Implementation Guidance

**Technology Stack Suggestions:**
- Test Framework: [Recommended framework based on language]
- Mocking Library: [Recommended library if applicable]
- Assertion Library: [Recommended assertion style]

**Code Examples:**
```csharp
[TestFixture]
public class [ClassNameTests] {
    
    [Test]
    public void TC_1_1_[TestDescription]() {
        // Arrange
        var [variableName] = new [ClassName]();
        var testInput = [TestData];
        
        // Act
        var result = [variableName].[MethodName](testInput);
        
        // Assert
        Assert.That(result, Is.[Assertion]([ExpectedValue]));
    }
}
```

**AAA Pattern:**
- Arrange: [Setup test data and objects]
- Act: [Execute the method under test]
- Assert: [Verify expected results]

### Coverage Report

**Overall Coverage Metrics:**
- Branch Coverage: [X%]
- Decision Coverage: [Y%]
- Path Coverage: [Z%]
- Line Coverage: [W%]

**Uncovered Branches/Paths:**
- [Description of any uncovered paths]
- [Recommendation for additional testing]

**High-Risk Areas:**
- [Methods or branches with high complexity or criticality]
- [Special attention needed for these areas]

### Test Prioritization

**Priority 1 - Critical Paths (Test First):**
- Core business logic
- Security-sensitive methods
- Data manipulation operations
- Error handling

**Priority 2 - High-Value Coverage:**
- Complex conditional logic
- Boundary conditions
- Loop iterations
- Integration points

**Priority 3 - Completeness:**
- Simple methods with low complexity
- Utility functions
- Getter/setter properties
- Helper methods

## Example Output

### File: PaymentProcessor.cs

**Method 1:** `public PaymentResult ProcessPayment(decimal amount, string cardType)`

**Test Objectives:**
- Verify payment processing for valid amounts
- Verify rejection of invalid card types
- Verify boundary value handling
- Verify exception handling for payment failures

**Test Cases:**

| Test ID | Test Case Name | Test Data | Expected Output | Code Path | Technique |
|---|---|---|---|---|---|
| TC-1.1 | Valid Credit Card Payment | amount: 100, cardType: "VISA" | PaymentResult.Success | Successful processing branch | Branch Coverage |
| TC-1.2 | Invalid Card Type | amount: 100, cardType: "INVALID" | PaymentResult.Failure | Card validation branch | Branch Coverage |
| TC-1.3 | Zero Amount | amount: 0, cardType: "VISA" | PaymentResult.Failure | Boundary condition | Boundary Value Analysis |
| TC-1.4 | Negative Amount | amount: -50, cardType: "VISA" | PaymentResult.Failure | Boundary condition | Boundary Value Analysis |
| TC-1.5 | Maximum Amount | amount: 999999.99, cardType: "VISA" | PaymentResult.Success | Boundary condition | Boundary Value Analysis |
| TC-1.6 | Payment Gateway Timeout | amount: 100, cardType: "VISA" | PaymentResult.Error | Exception path | Exception Path Testing |

**Branch Coverage:**
- Success path (valid amount, valid card): TC-1.1 ✓
- Invalid card type: TC-1.2 ✓
- Invalid amount (negative): TC-1.4 ✓
- Invalid amount (zero): TC-1.3 ✓
- Exception handling: TC-1.6 ✓
- Coverage: 100%

## Best Practices

1. **Write one assertion per test** - Keep tests focused and clear
2. **Use descriptive test names** - Names should explain what is being tested and expected outcome
3. **Follow AAA pattern** - Arrange, Act, Assert structure
4. **Test behavior, not implementation** - Focus on what the method should do
5. **Isolate dependencies** - Use mocking/stubbing for external dependencies
6. **Group related tests** - Use test fixtures/classes for organization
7. **Keep tests simple** - Each test should verify one behavior
8. **Use parameterized tests** - For equivalence partitions with similar test logic
9. **Document complex test logic** - Explain why a specific test is needed
10. **Maintain test data clarity** - Make test inputs and expected outputs explicit

## Constraints

- Focus on unit-level testing (single method/function scope)
- Assume unit testing framework appropriate to the language
- Suggest mocking strategies for external dependencies
- Prioritize branch and decision coverage
- Identify and document any untestable code patterns
- Recommend code refactoring for improved testability if needed

## Output Customization

Specify your preferences:

- **Language:** [C#/Java/Python/JavaScript/TypeScript/Go/Rust/etc.]
- **Test Framework:** [NUnit/xUnit/JUnit/pytest/Jest/Mocha/etc.]
- **Coverage Target:** [High/Very High/100%]
- **Output Detail Level:** [Summary/Detailed/Comprehensive]
- **Include Examples:** [Yes/No]
