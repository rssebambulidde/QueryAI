# Topics vs Search Filters: Key Differences

## Overview

QueryAI has **two different filtering mechanisms** that work together but serve different purposes:

1. **Search Filters** (existing) - Temporary, per-query filters for web search
2. **Topics** (new) - Persistent, organizational scoping system

---

## Quick Comparison Table

| Feature | Search Filters | Topics |
|---------|---------------|--------|
| **Persistence** | Temporary (per query) | Permanent (stored in database) |
| **Scope** | Web search only | Documents, web search, conversations, API keys, embeddings |
| **Storage** | Not saved | Saved in database |
| **Reusability** | Must re-enter each time | Select from dropdown |
| **Organization** | No organization | Organizes conversations and documents |
| **AI Context** | Limited | Full context enhancement |
| **Document Filtering** | ❌ No | ✅ Yes |
| **Conversation Linking** | ❌ No | ✅ Yes |
| **API Key Scoping** | ❌ No | ✅ Yes |
| **Embedding Scoping** | ❌ No | ✅ Yes |

---

## Detailed Comparison

### 1. **Persistence & Storage**

#### Search Filters
- **Temporary**: Filters are applied only to the current query
- **Not saved**: Filters are not stored in the database
- **Per-conversation**: Can be saved to conversation metadata, but still temporary
- **Example**: You enter "Bank of Uganda" in the keyword filter, ask a question, then the filter is cleared

#### Topics
- **Permanent**: Topics are stored in the database
- **Reusable**: Once created, you can select them from a dropdown anytime
- **Persistent**: Topics remain available across all conversations
- **Example**: You create "Bank of Uganda" topic once, then select it from dropdown whenever needed

---

### 2. **Scope & Functionality**

#### Search Filters
**What they affect:**
- ✅ Web search results only (Tavily API)
- ✅ Adds keyword to search query
- ✅ Filters web results by keyword

**What they DON'T affect:**
- ❌ Document search (Pinecone)
- ❌ AI prompt context
- ❌ Conversation organization
- ❌ API keys
- ❌ Embeddings

#### Topics
**What they affect:**
- ✅ Web search results (adds topic name to query + filters results)
- ✅ Document search (filters documents by topic)
- ✅ AI prompt context (adds topic context to system prompt)
- ✅ Conversation organization (links conversations to topics)
- ✅ API key scoping (limits API access to specific topics)
- ✅ Embedding scoping (chatbots limited to specific topics)

---

### 3. **User Experience**

#### Search Filters
**How to use:**
1. Click "Filter" button in chat input
2. Enter keyword in "Topic/Keyword" field
3. Optionally set time range, country
4. Ask question
5. Filter applies to that query only

**Characteristics:**
- Quick, one-time filtering
- Good for ad-hoc searches
- Must re-enter keywords each time
- No organization or history

#### Topics
**How to use:**
1. Create topic in Dashboard → Topics
2. Select topic from dropdown in chat interface
3. Ask questions (topic automatically applies)
4. Topic persists until you change it

**Characteristics:**
- Persistent, reusable filtering
- Good for focused work sessions
- Organizes conversations and documents
- Maintains context across multiple queries

---

### 4. **Technical Implementation**

#### Search Filters
```typescript
// Search Filters are passed as query parameters
const request = {
  question: "any new jobs?",
  topic: "Bank of Uganda",  // Just a string, not linked to anything
  timeRange: "day",
  country: "UG"
};

// Only affects web search
searchQuery = `"Bank of Uganda" any new jobs?`;
```

#### Topics
```typescript
// Topics are database entities with IDs
const topic = {
  id: "uuid-123",
  name: "Bank of Uganda",
  description: "Central bank information",
  user_id: "user-456"
};

// Affects multiple systems
// 1. Web search
searchQuery = `"Bank of Uganda" any new jobs?`;

// 2. Document search
PineconeService.search(query, {
  topicId: "uuid-123"  // Filters documents
});

// 3. AI prompt
systemPrompt = `You are answering questions about Bank of Uganda...`;

// 4. Conversation
conversation.topic_id = "uuid-123";

// 5. API key
apiKey.topic_id = "uuid-123";  // Scopes API access
```

---

### 5. **Use Cases**

#### When to Use Search Filters

**Best for:**
- ✅ One-time, ad-hoc searches
- ✅ Quick filtering without setup
- ✅ Testing different keywords
- ✅ Temporary, exploratory queries
- ✅ When you don't need organization

**Example:**
```
"I want to search for 'renewable energy' news from last week in Kenya"
→ Use Search Filters:
   - Keyword: "renewable energy"
   - Time: Last week
   - Country: Kenya
→ Ask question
→ Done (no need to save)
```

#### When to Use Topics

**Best for:**
- ✅ Focused work on specific subjects
- ✅ Multiple queries about the same topic
- ✅ Organizing conversations by subject
- ✅ Document management and tagging
- ✅ Creating embeddable chatbots
- ✅ API access control
- ✅ Long-term project work

**Example:**
```
"I'm working on a Bank of Uganda research project"
→ Create Topic: "Bank of Uganda"
→ Upload relevant documents (tagged with topic)
→ Select topic in chat
→ Ask multiple questions:
   - "What are the latest policies?"
   - "Any new job openings?"
   - "What are the interest rates?"
→ All conversations are organized under this topic
→ Can create API key scoped to this topic
→ Can create chatbot for this topic
```

---

### 6. **How They Work Together**

**You can use BOTH at the same time!**

Example:
1. **Select Topic**: "Bank of Uganda" (persistent, affects documents + web + AI context)
2. **Add Search Filter**: "Last 24 hours" (temporary, affects web search only)
3. **Ask Question**: "Any new job opportunities?"

**Result:**
- Web search: Searches for "Bank of Uganda" jobs from last 24 hours
- Document search: Only searches documents tagged with "Bank of Uganda" topic
- AI context: Knows you're asking about Bank of Uganda
- Time filter: Only returns recent results

**The Topic provides the domain scope, while Search Filters provide temporal/geographic refinement.**

---

## Visual Comparison

### Search Filters Flow
```
User clicks Filter
    ↓
Enters keyword: "Bank of Uganda"
Sets time: "Last 24 hours"
Sets country: "UG"
    ↓
Asks question: "Any new jobs?"
    ↓
Filter applied to THIS query only
    ↓
Next question: Filter is gone (unless saved to conversation)
```

### Topics Flow
```
User creates Topic: "Bank of Uganda"
    ↓
Selects topic from dropdown
    ↓
Asks question: "Any new jobs?"
    ↓
Topic applies automatically
    ↓
Asks another question: "What are the policies?"
    ↓
Topic STILL applies (persistent)
    ↓
All conversations linked to this topic
```

---

## Key Differences Summary

### Search Filters
- 🎯 **Purpose**: Quick, temporary filtering
- 📝 **Type**: Text input (free-form keyword)
- 💾 **Storage**: Not saved (or saved to conversation metadata)
- 🔄 **Reusability**: Must re-enter
- 📊 **Scope**: Web search only
- 🗂️ **Organization**: None

### Topics
- 🎯 **Purpose**: Persistent, organizational scoping
- 📝 **Type**: Database entity (name + description)
- 💾 **Storage**: Saved in database
- 🔄 **Reusability**: Select from dropdown
- 📊 **Scope**: Documents, web, AI context, conversations, API keys, embeddings
- 🗂️ **Organization**: Full conversation and document organization

---

## Recommendation: When to Use Which?

### Use Search Filters When:
- You need a quick, one-time filter
- You're exploring different keywords
- You want to test search parameters
- You don't need to organize conversations
- You're doing ad-hoc research

### Use Topics When:
- You're working on a specific project/subject
- You'll ask multiple questions about the same domain
- You want to organize conversations
- You're uploading documents for a specific purpose
- You need to create API keys or chatbots
- You want persistent context across queries

### Use Both When:
- You have a topic selected (for domain scope)
- You want to add time/country filters (for refinement)
- You need both persistent organization AND temporary refinement

---

## Example Scenarios

### Scenario 1: Quick Research
**Task**: "I want to quickly check renewable energy news from Kenya last week"

**Solution**: Use Search Filters
- Keyword: "renewable energy"
- Time: Last week
- Country: Kenya
- Ask question
- Done (no need to save)

### Scenario 2: Project Work
**Task**: "I'm researching Bank of Uganda policies for a month-long project"

**Solution**: Use Topics
- Create topic: "Bank of Uganda"
- Upload relevant documents
- Select topic
- Ask multiple questions over time
- All conversations organized under this topic

### Scenario 3: Focused Research with Time Constraints
**Task**: "I'm working on Bank of Uganda research, but I only want news from the last 24 hours"

**Solution**: Use Both
- Select topic: "Bank of Uganda" (for domain scope)
- Add search filter: "Last 24 hours" (for time refinement)
- Ask questions
- Topic persists, time filter applies to each query

---

## Conclusion

**Search Filters** and **Topics** are complementary features:

- **Search Filters** = Quick, temporary refinement
- **Topics** = Persistent, organizational scoping

Use Search Filters for quick, ad-hoc filtering.
Use Topics for focused, organized work.
Use both together for maximum flexibility!
