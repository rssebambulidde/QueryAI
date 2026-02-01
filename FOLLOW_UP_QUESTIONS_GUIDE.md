# Follow-Up Questions: Naming and Generation Guide

## Current Naming

Currently, these questions are called:
- **"Follow-up questions"** (technical/internal)
- **"Suggested follow-ups"** (user-facing UI label)

## Naming Options Analysis

### Option 1: "Follow-up Questions" (Current)
**Pros:**
- Clear and descriptive
- Standard terminology in chat/AI contexts
- Indicates they continue the conversation thread

**Cons:**
- Can feel formal or technical
- Doesn't emphasize they're AI-suggested

**Used by:** ChatGPT, some AI assistants

---

### Option 2: "Suggested Questions" / "Suggested Follow-ups"
**Pros:**
- Emphasizes they're AI-generated suggestions
- Friendly and approachable
- Clear that clicking them will ask a question

**Cons:**
- Slightly longer text
- "Suggested" might imply optional/less important

**Used by:** Current UI, Perplexity (similar)

---

### Option 3: "Related Questions"
**Pros:**
- Emphasizes relevance to current topic
- Common in search engines (Google's "People also ask")
- Shorter and cleaner

**Cons:**
- Less clear they're clickable actions
- Could be confused with search suggestions

**Used by:** Google Search, Bing

---

### Option 4: "Ask More" / "Explore Further"
**Pros:**
- Action-oriented
- Encourages engagement
- Modern, conversational tone

**Cons:**
- Less descriptive
- Doesn't indicate they're questions

**Used by:** Some modern chat UIs

---

### Option 5: "You Might Also Ask"
**Pros:**
- Personal and conversational
- Clear they're suggestions for the user
- Similar to e-commerce "You might also like"

**Cons:**
- Longer text
- Less common in AI chat contexts

---

## Recommendation

**Best name: "Related Questions"** or **"Suggested Questions"**

**Reasoning:**
1. **"Related Questions"** - Best for clarity and brevity
   - Emphasizes relevance to current topic
   - Familiar from search engines
   - Short and scannable
   - Works well: "Related questions:" as header

2. **"Suggested Questions"** - Best for clarity about AI generation
   - Makes it clear they're AI-generated
   - Indicates they're actionable (clickable)
   - Current UI already uses "Suggested follow-ups"

**Implementation:**
- Keep internal code as `followUpQuestions` (technical term)
- Update UI label to **"Related questions"** or **"Suggested questions"**
- Keep component name `FollowUpQuestions` (React component naming convention)

---

## How They're Generated

### Primary Method: Main AI Model Includes Them

**Location:** `backend/src/services/ai.service.ts` - `getFollowUpBlock()`

**Process:**
1. The main AI model (GPT-3.5/GPT-4) is instructed via system prompt to **always** end responses with a `FOLLOW_UP_QUESTIONS:` block
2. The prompt requires exactly **4 questions** that are:
   - Dynamically generated from the latest Q&A (not templates)
   - Directly related to the user's question and the answer
   - Specific and actionable
   - Phrased as complete questions
   - Within the research topic (if in Research Mode)

**Example prompt instruction:**
```
FOLLOW-UP QUESTIONS (MANDATORY - EVERY RESPONSE):
After your complete answer, add "FOLLOW_UP_QUESTIONS:" followed by exactly 4 questions, one per line, each starting with "- "
These questions should:
- Be directly related to the user's question and your answer
- Explore different aspects, deeper details, or related topics
- Be specific and actionable (not generic)
```

**Response format:**
```
[Answer content]

FOLLOW_UP_QUESTIONS:
- How does [topic] work in practice?
- What are the key benefits and challenges of [topic]?
- Can you provide examples of [topic] in real-world applications?
- What should I know about [related aspect]?
```

---

### Fallback Method: Separate AI Call

**Location:** `backend/src/services/ai.service.ts` - `generateFollowUpQuestions()`

**When used:**
- If the main model doesn't include follow-up questions in its response
- As a fallback to ensure every response has follow-ups

**Process:**
1. Takes the user's question and the assistant's answer
2. Makes a separate API call to OpenAI with a focused prompt
3. Prompt asks to generate exactly 4 questions based on the Q&A exchange
4. Uses GPT-3.5-turbo with temperature 0.5 (more focused)
5. Parses the response to extract 4 questions

**Prompt example:**
```
Based on this exchange, generate exactly 4 short follow-up questions.

User asked: [question]
Assistant answered: [answer]

Output only the 4 questions, one per line. No numbering or bullets. 
Each must be a complete question and derived from the specific content above.
```

**Code location:**
- Backend: `backend/src/routes/ai.routes.ts` lines 416-423
- Service: `backend/src/services/ai.service.ts` lines 785-837

---

### Parsing Process

**Location:** `backend/src/routes/ai.routes.ts` lines 385-413

**Steps:**
1. **Primary extraction:** Look for `FOLLOW_UP_QUESTIONS:` block in response
   - Regex: `/(?:FOLLOW_UP_QUESTIONS|Follow[- ]?up questions?):\s*\n((?:[-*•]\s+[^\n]+\n?)+)/i`
   - Extracts questions starting with `-`, `*`, or `•`
   - Limits to 4 questions

2. **Fallback extraction:** If no block found, look for bullet points at end
   - Checks last 700 characters for bullet lines
   - Extracts 1-4 bullet points that look like questions
   - Removes them from the answer content

3. **AI fallback:** If still no questions found
   - Calls `AIService.generateFollowUpQuestions()`
   - Separate API call to generate questions

4. **Send to frontend:**
   - Included in streaming response as `{ followUpQuestions: [...] }`
   - Stored in message metadata in database

---

### Frontend Display

**Location:** `frontend/components/chat/follow-up-questions.tsx`

**Current label:** "Suggested follow-ups:"

**Rendering:**
- Displayed below assistant messages
- Shown as clickable pill buttons
- Each button shows the question text
- Clicking sends the question through the same RAG flow as regular messages

---

## Summary

**Current naming:** "Follow-up questions" (technical) / "Suggested follow-ups" (UI)

**Recommended naming:** 
- **UI:** "Related questions" or "Suggested questions"
- **Code:** Keep `followUpQuestions` (technical term)

**Generation:**
1. **Primary:** Main AI model includes them in response (mandatory instruction)
2. **Fallback 1:** Extract from bullet points if not in block format
3. **Fallback 2:** Separate AI call to generate questions if missing

**Quality:**
- Questions are dynamically generated from the specific Q&A
- Not generic templates
- Context-aware (respects research topic if active)
- Always 4 questions per response
