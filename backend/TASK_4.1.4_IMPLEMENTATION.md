# Task 4.1.4: Implement Conflict Resolution Instructions Implementation

## Overview
Implemented comprehensive conflict resolution guidelines with strategies for handling conflicting sources, instructions for acknowledging uncertainty, and examples. The system now provides detailed guidance on how to handle conflicts between sources to ensure reliable and transparent answers.

## Files Created

### 1. `backend/src/data/conflict-resolution-guidelines.json`
- **Conflict Resolution Guidelines Database**: JSON database of conflict resolution strategies, handling guidelines, and examples
- **Key Features**:
  - **Conflict Resolution Strategies**: Five strategies (source authority, recency, consensus, contextual relevance, evidence strength) with when to use and examples
  - **Handling Conflicts**: Four approaches (acknowledge conflict, present both perspectives, prioritize with explanation, avoid speculation) with requirements and examples
  - **Acknowledging Uncertainty**: Guidelines on when and how to acknowledge uncertainty, with uncertainty phrases
  - **Examples**: Conflict resolution examples and uncertainty acknowledgment examples
  - **Best Practices**: Transparency, fairness, user empowerment, source attribution
  - **Common Mistakes**: Four common mistakes with wrong/correct examples
  - **Checklist**: Pre-submission checklist for conflict resolution

- **Structure**:
  - `strategies`: Five conflict resolution strategies
  - `handlingConflicts`: Four approaches for handling conflicts
  - `acknowledgingUncertainty`: Guidelines on when and how to acknowledge uncertainty
  - `examples`: Conflict and uncertainty examples
  - `bestPractices`: Best practices for conflict resolution
  - `commonMistakes`: Common mistakes with wrong/correct examples
  - `checklist`: Pre-submission checklist

### 2. `backend/src/services/conflict-resolution.service.ts`
- **ConflictResolutionService**: Service for providing conflict resolution guidelines and strategies
- **Key Features**:
  - **Guidelines Formatting**: Formats conflict resolution guidelines for system prompt
  - **Strategy Retrieval**: Gets specific conflict resolution strategies
  - **Example Retrieval**: Gets conflict resolution examples
  - **Caching**: Caches guidelines for performance

- **Methods**:
  - `formatConflictResolutionGuidelines()`: Formats conflict resolution guidelines for system prompt
  - `getStrategy(strategyType)`: Gets specific conflict resolution strategy
  - `getConflictExamples()`: Gets conflict resolution examples
  - `loadGuidelines()`: Loads conflict resolution guidelines from JSON file (cached)
  - `clearCache()`: Clears guidelines cache

## Files Modified

### 1. `backend/src/services/ai.service.ts`
- Added import for `ConflictResolutionService`
- Updated `buildSystemPrompt` method:
  - Loads conflict resolution guidelines using `ConflictResolutionService.formatConflictResolutionGuidelines()`
  - Includes conflict resolution guidelines in system prompt
  - Conflict resolution guidelines appear after quality guidelines
- Conflict resolution guidelines include:
  - Conflict resolution strategies
  - Handling conflicts approaches
  - Acknowledging uncertainty guidelines
  - Conflict resolution examples
  - Best practices
  - Common mistakes to avoid
  - Conflict resolution checklist

## Features

### 1. Conflict Resolution Strategies

#### Source Authority
- **Description**: Prioritize sources based on authority and reliability
- **When to Use**: When sources have different levels of authority or credibility
- **Approach**:
  - Prioritize authoritative sources (academic, official, reputable organizations)
  - Consider source expertise and domain authority
  - Prefer recent sources from established institutions
  - Acknowledge when using authority-based prioritization
- **Example**: When a government report conflicts with a blog post, prioritize the government report but acknowledge both sources exist.

#### Recency
- **Description**: Prioritize more recent information when sources conflict
- **When to Use**: When information changes over time or sources are from different time periods
- **Approach**:
  - Prioritize more recent sources when information is time-sensitive
  - Acknowledge that information may have changed
  - Note the time difference between sources
  - Use recent information but mention older perspectives if relevant
- **Example**: When a 2020 study conflicts with a 2024 study, prioritize the 2024 study but note that the 2020 study may have been valid at that time.

#### Consensus
- **Description**: Present multiple perspectives when sources conflict
- **When to Use**: When multiple credible sources have different views and no clear authority exists
- **Approach**:
  - Present both perspectives fairly
  - Cite each perspective with its source
  - Acknowledge the disagreement
  - Explain why there might be disagreement
  - Avoid taking sides when both are credible
- **Example**: When two reputable studies have different conclusions, present both perspectives with their sources and acknowledge the disagreement.

#### Contextual Relevance
- **Description**: Prioritize sources most relevant to the specific context
- **When to Use**: When sources address different contexts or scopes
- **Approach**:
  - Prioritize sources most directly relevant to the question
  - Consider geographic, temporal, or domain-specific context
  - Acknowledge when context affects applicability
  - Note limitations of sources to specific contexts
- **Example**: When a US-specific study conflicts with a global study, prioritize based on the question's context (US vs. global).

#### Evidence Strength
- **Description**: Prioritize sources with stronger evidence or methodology
- **When to Use**: When sources have different levels of evidence quality
- **Approach**:
  - Prioritize sources with stronger methodology
  - Consider sample size, study design, and evidence quality
  - Acknowledge methodological differences
  - Note limitations of weaker evidence
- **Example**: When a peer-reviewed study conflicts with an anecdotal report, prioritize the peer-reviewed study but acknowledge both exist.

### 2. Handling Conflicts

#### Acknowledge Conflict
- **Description**: Always acknowledge when sources conflict
- **Requirements**:
  - Explicitly state that sources disagree
  - Present conflicting information fairly
  - Cite each conflicting source
  - Avoid hiding or ignoring conflicts
- **Example**: "Sources provide conflicting information about this topic. [Source A](url) states X, while [Source B](url) states Y."

#### Present Both Perspectives
- **Description**: Present both perspectives when appropriate
- **Requirements**:
  - Give equal weight to both perspectives when both are credible
  - Cite each perspective with its source
  - Explain the nature of the disagreement
  - Avoid bias toward one perspective
- **Example**: "There are different perspectives on this issue. According to [Source A](url), the approach is X. However, [Source B](url) suggests Y. Both perspectives have merit."

#### Prioritize With Explanation
- **Description**: When prioritizing one source, explain why
- **Requirements**:
  - Clearly state which source is being prioritized
  - Explain the reason for prioritization (authority, recency, evidence, etc.)
  - Acknowledge the alternative perspective
  - Cite both sources
- **Example**: "While [Source A](url) suggests X, [Source B](url) (a more recent study from 2024) indicates Y. Based on recency, Y is more likely accurate."

#### Avoid Speculation
- **Description**: Don't speculate about which source is correct
- **Requirements**:
  - Avoid guessing which source is right
  - Don't make unsupported claims about source accuracy
  - Present facts and let the user decide when appropriate
  - Acknowledge uncertainty when sources conflict
- **Example**: "Sources conflict on this point. [Source A](url) states X, while [Source B](url) states Y. Without additional information, it's unclear which is accurate."

### 3. Acknowledging Uncertainty

#### When to Acknowledge
- **Conflicting Sources**: When sources provide conflicting information
- **Limited Sources**: When only one source is available and it may not be comprehensive
- **Outdated Information**: When sources are old and information may have changed
- **Methodological Limitations**: When sources have limitations in methodology or scope
- **Incomplete Information**: When sources don't fully address the question
- **Ambiguous Information**: When information is unclear or open to interpretation

#### How to Acknowledge
- **Explicit Statements**: Use phrases like "sources conflict", "information is unclear", "may vary", "uncertain"
- **Be Direct**: Be direct about limitations
- **Explain Why**: Explain why there's uncertainty
- **Cite Sources**: Cite sources even when acknowledging uncertainty

#### Uncertainty Phrases
- "Sources conflict on this point"
- "Information is unclear"
- "May vary depending on"
- "Uncertain based on available sources"
- "Sources provide different perspectives"
- "Limited information available"
- "May have changed since"
- "Open to interpretation"
- "Not definitively established"
- "Requires further investigation"

### 4. Examples

#### Conflict Examples
- **Example 1**: Two sources provide different statistics
- **Example 2**: Recent source conflicts with older source
- **Example 3**: Authoritative source conflicts with less authoritative source
- **Example 4**: Multiple credible sources with different perspectives

#### Uncertainty Examples
- **Example 1**: Only one source available
- **Example 2**: Outdated information
- **Example 3**: Ambiguous information

### 5. Best Practices

#### Transparency
- Always be transparent about conflicts
- Don't hide conflicting information
- Cite all conflicting sources
- Explain why you're prioritizing one source

#### Fairness
- Present conflicting perspectives fairly
- Don't bias toward one perspective
- Give equal weight when both are credible
- Acknowledge merit in different perspectives

#### User Empowerment
- Present information so users can make informed decisions
- Don't make decisions for users when sources conflict
- Provide enough context for users to evaluate
- Acknowledge limitations and uncertainties

#### Source Attribution
- Always cite conflicting sources
- Make it clear which source says what
- Don't merge conflicting information
- Maintain clear source attribution

### 6. Common Mistakes

#### Ignoring Conflicts
- **Mistake**: Ignoring or hiding conflicting information
- **Correct**: Always acknowledge conflicts and present both perspectives
- **Example**: Wrong vs. correct examples

#### Taking Sides
- **Mistake**: Taking sides without explanation when both sources are credible
- **Correct**: Present both perspectives fairly or explain why one is prioritized
- **Example**: Wrong vs. correct examples

#### Speculating
- **Mistake**: Speculating about which source is correct without evidence
- **Correct**: Acknowledge uncertainty and present both perspectives
- **Example**: Wrong vs. correct examples

#### Merging Conflicts
- **Mistake**: Merging conflicting information into a single statement
- **Correct**: Present conflicts separately with clear source attribution
- **Example**: Wrong vs. correct examples

### 7. Checklist

#### Before Submission
- Check for any conflicting information in sources
- Acknowledge all conflicts explicitly
- Cite all conflicting sources
- Explain prioritization if applicable
- Acknowledge uncertainty when appropriate
- Present conflicting perspectives fairly
- Avoid speculation about source accuracy
- Maintain clear source attribution

## Usage Example

```typescript
// Conflict resolution guidelines are automatically included in system prompt
const response = await AIService.askQuestion({
  question: "What is the current unemployment rate?",
  userId: "user123",
});

// Get specific conflict resolution strategy
const strategy = ConflictResolutionService.getStrategy('recency');
console.log('Strategy:', strategy);

// Get conflict examples
const examples = ConflictResolutionService.getConflictExamples();
console.log('Examples:', examples);
```

## Conflict Resolution Guidelines Format

The conflict resolution guidelines are formatted as:

```
=== CONFLICT RESOLUTION GUIDELINES ===

CONFLICT RESOLUTION STRATEGIES:
When sources provide conflicting information, use these strategies:

Source Authority:
  Prioritize sources based on authority and reliability
  When to use: When sources have different levels of authority...
  Approach:
  - Prioritize authoritative sources...
  Example: When a government report conflicts...

ACKNOWLEDGING UNCERTAINTY:
Acknowledge uncertainty in these situations:

When to Acknowledge:
- Conflicting Sources: When sources provide conflicting information
- Limited Sources: When only one source is available...
...

CONFLICT RESOLUTION EXAMPLES:
Conflict Examples:
Scenario: Two sources provide different statistics
Conflict: Source A says 50%, Source B says 60%
Resolution: Sources provide different statistics...

BEST PRACTICES:
Transparency:
- Always be transparent about conflicts
...

COMMON MISTAKES TO AVOID:
Ignoring Conflicts:
  Mistake: Ignoring or hiding conflicting information
  Correct: Always acknowledge conflicts...
  Wrong: The answer is X. [Source A](url)
  Correct: Sources provide conflicting information...

=== END CONFLICT RESOLUTION GUIDELINES ===
```

## Acceptance Criteria

✅ **Conflicts handled appropriately**
- Five conflict resolution strategies for different situations
- Four approaches for handling conflicts
- Examples demonstrate proper conflict handling
- Best practices ensure appropriate handling
- Checklist ensures conflicts are handled before submission

✅ **Uncertainty acknowledged**
- Clear guidelines on when to acknowledge uncertainty
- How to acknowledge uncertainty with explicit statements
- Uncertainty phrases provided
- Examples show proper uncertainty acknowledgment
- Checklist ensures uncertainty is acknowledged

✅ **Better answer reliability**
- Strategies ensure reliable source prioritization
- Transparency ensures users understand conflicts
- Fairness ensures balanced presentation
- Source attribution maintains reliability
- Best practices improve overall answer reliability

## Conflict Resolution Example

### Scenario: Two Sources Provide Different Statistics

**Conflict**: Source A says 50%, Source B says 60%

**Resolution**:
"Sources provide different statistics for this metric. [Source A](url) reports 50%, while [Source B](url) reports 60%. The difference may be due to different methodologies, time periods, or sample populations. Both sources are cited for transparency."

**Quality**: ✅ Acknowledges conflict, ✅ Presents both perspectives, ✅ Cites both sources, ✅ Explains possible reasons, ✅ Maintains transparency

## Testing Recommendations

1. **Unit Tests**: Test conflict resolution guidelines formatting
2. **Strategy Tests**: Test strategy retrieval for different types
3. **Example Tests**: Test conflict example retrieval
4. **Integration Tests**: Test integration with system prompt
5. **Quality Tests**: Verify conflict resolution improves answer reliability
6. **Edge Cases**:
   - No conflicts in sources
   - Multiple conflicts
   - All sources conflict
   - Unclear conflicts
7. **Performance Tests**: Test caching performance
8. **Validation Tests**: Verify conflict resolution checklist items

## Future Enhancements

1. **Automatic Conflict Detection**: Detect conflicts automatically in sources
2. **Conflict Scoring**: Score conflicts based on severity
3. **Strategy Recommendation**: Recommend strategies based on conflict type
4. **Conflict Analytics**: Track conflict resolution patterns
5. **User Feedback Integration**: Learn from user feedback on conflict resolution
6. **Real-time Conflict Detection**: Detect conflicts during response generation
7. **Conflict Resolution Learning**: Learn optimal strategies from examples
