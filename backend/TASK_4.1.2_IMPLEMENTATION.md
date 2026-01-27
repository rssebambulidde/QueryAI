# Task 4.1.2: Enhance Citation Instructions Implementation

## Overview
Implemented enhanced citation instructions with detailed format guidelines, examples, and validation rules. The system now provides comprehensive citation instructions that specify when to cite, how to format citations, and how to validate citations.

## Files Created

### 1. `backend/src/data/citation-examples.json`
- **Citation Guidelines Database**: JSON database of citation format guidelines and examples
- **Key Features**:
  - **When to Cite**: Clear guidelines on when citations are required (facts, statistics, quotes, claims, definitions, dates, locations, names, processes, comparisons)
  - **Citation Formats**: Detailed formats for document citations, document citations with URLs, web citations, and web citations with titles
  - **Citation Placement**: Guidelines for inline citations, sentence-start citations, and sentence-end citations
  - **Citation Examples**: Examples for different types of citations (factual statements, statistics, quotes, definitions, processes, comparisons)
  - **Common Mistakes**: Examples of common citation mistakes and how to correct them
  - **Citation Rules**: Mandatory rules, formatting rules, placement rules, and validation rules

- **Structure**:
  - `whenToCite`: Dictionary of citation triggers (facts, statistics, quotes, etc.)
  - `citationFormats`: Formats for different citation types
  - `citationPlacement`: Guidelines for citation placement
  - `citationExamples`: Examples for different citation scenarios
  - `citationRules`: Mandatory, formatting, placement, and validation rules
  - `commonMistakes`: Common mistakes with wrong/correct examples

### 2. `backend/src/services/citation-validator.service.ts`
- **CitationValidatorService**: Service for validating citation formats and providing citation guidelines
- **Key Features**:
  - **Format Validation**: Validates citation format in text
  - **Citation Extraction**: Extracts citations from text
  - **Guidelines Formatting**: Formats citation guidelines for system prompt
  - **Example Retrieval**: Retrieves citation examples by type
  - **Caching**: Caches guidelines for performance

- **Validation Features**:
  - **Markdown Link Validation**: Validates markdown link format
  - **URL Validation**: Validates URL format and completeness
  - **Missing Citation Detection**: Detects potential missing citations
  - **Citation Clustering Detection**: Detects citation clustering at paragraph end
  - **Format Error Detection**: Detects format errors in citations

- **Methods**:
  - `validateCitationFormat(text)`: Validates citation format in text
  - `extractCitations(text)`: Extracts citations from text
  - `formatCitationGuidelines()`: Formats citation guidelines for system prompt
  - `getCitationExamples(type?)`: Gets citation examples for specific type
  - `loadGuidelines()`: Loads citation guidelines from JSON file (cached)
  - `clearCache()`: Clears guidelines cache

## Files Modified

### 1. `backend/src/services/ai.service.ts`
- Added import for `CitationValidatorService`
- Updated `buildSystemPrompt` method:
  - Loads citation guidelines using `CitationValidatorService.formatCitationGuidelines()`
  - Includes enhanced citation instructions in system prompt
  - Adds citation enforcement instructions
- Enhanced citation instructions include:
  - When to cite (facts, statistics, quotes, etc.)
  - Citation formats (document, web, with URLs)
  - Citation placement guidelines
  - Citation examples by type
  - Common mistakes to avoid
  - Mandatory citation rules
  - Formatting rules
  - Validation rules
  - Citation enforcement checklist

## Features

### 1. Citation Guidelines

#### When to Cite
- **Facts**: All factual claims, data points, and verifiable information
- **Statistics**: All statistics, numbers, percentages, and quantitative data
- **Quotes**: All direct quotes, paraphrased quotes, and attributed statements
- **Claims**: All claims, assertions, and statements of fact
- **Definitions**: All definitions, explanations of terms, and conceptual descriptions
- **Dates**: All dates, timeframes, and temporal information
- **Locations**: All geographic locations, places, and spatial information
- **Names**: All proper names, organizations, and entities when first mentioned
- **Processes**: All descriptions of processes, procedures, and methodologies
- **Comparisons**: All comparisons, contrasts, and relative statements

#### Citation Formats
- **Document Citations**: `[Document N]` format
- **Document Citations with URL**: `[Document Name](document://id)` format
- **Web Citations**: `[Web Source N](URL)` format
- **Web Citations with Title**: `[Title](URL)` format

#### Citation Placement
- **Inline Citations**: Preferred placement within sentences
- **Sentence-Start Citations**: When entire sentence is from one source
- **Sentence-End Citations**: When entire sentence is from one source

### 2. Citation Validation

#### Validation Rules
- **Format Validation**: Validates markdown link format
- **URL Validation**: Validates URL format and completeness
- **Missing Citation Detection**: Detects potential missing citations
- **Citation Clustering Detection**: Detects citation clustering at paragraph end
- **Format Error Detection**: Detects format errors in citations

#### Validation Results
- **isValid**: Boolean indicating if citations are valid
- **errors**: Array of citation format errors
- **warnings**: Array of potential issues (missing citations, suspicious URLs)
- **suggestions**: Array of suggestions for improvement

### 3. Citation Examples

#### Example Types
- **Factual Statement**: Example with fact citation
- **Statistical Data**: Example with statistic citation
- **Direct Quote**: Example with quote citation
- **Paraphrased Quote**: Example with paraphrase citation
- **Definition**: Example with definition citation
- **Process Description**: Example with process citation
- **Comparison**: Example with comparison citations
- **Multiple Facts**: Example with multiple citations
- **Single Source Multiple Facts**: Example with single source citation

### 4. Common Mistakes

#### Mistake Types
- **Missing Citations**: Presenting facts without citations
- **Incorrect Format**: Using incorrect citation format
- **Wrong URL**: Using incorrect or incomplete URLs
- **Missing URL**: Web citations without URLs
- **Citation Clustering**: Placing all citations at paragraph end
- **Citation to Non-Existent Source**: Citing sources not in context

#### Correction Examples
Each mistake includes:
- **Mistake**: Description of the mistake
- **Correct**: How to fix it
- **Example**: Wrong vs. correct examples

### 5. Citation Enforcement

#### Enforcement Checklist
- Verify that EVERY factual statement has a citation
- Check that ALL statistics, numbers, and data points are cited
- Ensure ALL quotes and attributed statements have citations
- Validate that citation formats match the examples provided
- Confirm that URLs in web citations match exactly those provided in the context
- If any uncited factual information is found, either add a citation or remove that information

## Usage Example

```typescript
// Citation guidelines are automatically included in system prompt
const response = await AIService.askQuestion({
  question: "What is machine learning?",
  userId: "user123",
});

// Citation validation can be used separately
const validation = CitationValidatorService.validateCitationFormat(response.answer);
if (!validation.isValid) {
  console.log('Citation errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
  console.log('Suggestions:', validation.suggestions);
}

// Extract citations from text
const citations = CitationValidatorService.extractCitations(response.answer);
console.log('Document citations:', citations.documentCitations);
console.log('Web citations:', citations.webCitations);
```

## Citation Guidelines Format

The citation guidelines are formatted as:

```
=== ENHANCED CITATION INSTRUCTIONS ===

WHEN TO CITE (MANDATORY):
- Facts: Cite all factual claims, data points, and verifiable information
- Statistics: Cite all statistics, numbers, percentages, and quantitative data
- Quotes: Cite all direct quotes, paraphrased quotes, and attributed statements
...

CITATION FORMATS:
1. Document Citations:
   Format: [Document N]
   Examples: [Document 1], [Document 2], [Document 3]
   Rules:
   - Use the exact label from the 'Relevant Document Excerpts' section
   ...

2. Web Citations:
   Format: [Web Source N](URL)
   Examples: [Web Source 1](https://example.com/article), ...
   Rules:
   - Use the exact label from the 'Web Search Results' section
   - ALWAYS include the full URL in parentheses
   ...

CITATION PLACEMENT:
1. Inline Citations (PREFERRED):
   Examples:
   - Machine learning is a subset of AI [Document 1] that enables systems...
   ...

CITATION EXAMPLES BY TYPE:
Factual Statement:
   Example: The population of Tokyo is approximately 14 million people [Web Source 1](https://example.com/tokyo-population).
   Explanation: Cite factual information with the source immediately after the fact
...

COMMON MISTAKES TO AVOID:
Missing Citations:
   Wrong: The population is 14 million.
   Correct: The population is 14 million [Web Source 1](https://example.com/population).
   Rule: Always include citations for all factual information
...

MANDATORY CITATION RULES:
- EVERY factual statement MUST have a citation
- EVERY statistic MUST have a citation
...

=== END ENHANCED CITATION INSTRUCTIONS ===
```

## Acceptance Criteria

✅ **Citations more consistent**
- Detailed format guidelines ensure consistent citation format
- Examples demonstrate proper citation format
- Common mistakes section helps avoid inconsistencies
- Validation rules enforce consistency
- Citation enforcement checklist ensures consistency

✅ **Citation format correct**
- Detailed format specifications for each citation type
- Examples show correct format for each type
- Validation detects format errors
- Common mistakes section shows wrong vs. correct format
- Formatting rules ensure correct format

✅ **Better citation coverage**
- Clear guidelines on when to cite (10+ types)
- Examples for different citation scenarios
- Missing citation detection
- Citation enforcement checklist
- Validation warnings for potential missing citations

## Citation Validation Examples

### Example 1: Valid Citations
```
Text: "Machine learning is a subset of AI [Document 1] that enables systems to learn from data [Web Source 1](https://example.com/ml)."
Validation: { isValid: true, errors: [], warnings: [], suggestions: [] }
```

### Example 2: Missing Citations
```
Text: "The population is 14 million. The city covers 2,000 km²."
Validation: {
  isValid: true,
  errors: [],
  warnings: [
    "Potential missing citation in sentence: 'The population is 14 million...'",
    "Potential missing citation in sentence: 'The city covers 2,000 km²...'"
  ],
  suggestions: []
}
```

### Example 3: Format Errors
```
Text: "Source: https://example.com"
Validation: {
  isValid: false,
  errors: ["Invalid markdown link format: Source: https://example.com"],
  warnings: [],
  suggestions: []
}
```

### Example 4: Citation Clustering
```
Text: "The population is 14 million. The city covers 2,000 km². [Web Source 1](https://example.com)"
Validation: {
  isValid: true,
  errors: [],
  warnings: [],
  suggestions: [
    "Consider placing citations inline throughout the text rather than clustering them at the end"
  ]
}
```

## Testing Recommendations

1. **Unit Tests**: Test citation format validation with various formats
2. **Validation Tests**: Verify validation detects errors and warnings
3. **Extraction Tests**: Test citation extraction from text
4. **Guidelines Tests**: Test citation guidelines formatting
5. **Example Tests**: Test citation example retrieval
6. **Edge Cases**:
   - Empty text
   - Text with no citations
   - Text with only document citations
   - Text with only web citations
   - Text with mixed citations
   - Text with invalid citations
7. **Integration Tests**: Test integration with system prompt
8. **Quality Tests**: Verify enhanced instructions improve citation quality

## Future Enhancements

1. **Real-time Validation**: Validate citations during response generation
2. **Citation Suggestions**: Suggest citations for uncited facts
3. **Citation Quality Scoring**: Score citation quality
4. **Citation Analytics**: Track citation usage and quality
5. **Custom Citation Formats**: Support for custom citation formats
6. **Citation Templates**: Pre-defined citation templates for common scenarios
7. **Citation Learning**: Learn from user corrections to improve guidelines
