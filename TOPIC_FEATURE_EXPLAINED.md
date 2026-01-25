# Topic Feature: Complete Guide

## What Are Topics?

**Topics** are customizable knowledge scopes that help you organize and focus your AI queries on specific domains, subjects, or areas of interest. Think of them as "lenses" that filter and refine how the AI searches for information and generates answers.

### Simple Analogy
Imagine you have a library with books on many subjects. Instead of searching the entire library every time, Topics let you:
- Create a "section" for "Bank of Uganda" 
- Create another "section" for "Uganda Politics"
- Create another for "Technology News"

When you ask a question, the AI only searches within your selected topic's "section," giving you more relevant, focused answers.

---

## How Topics Work

### 1. **Topic Creation**
You create topics with:
- **Name**: A descriptive name (e.g., "Bank of Uganda", "Uganda Politics", "Renewable Energy")
- **Description**: Optional details about what the topic covers

**Example:**
```
Topic Name: "Bank of Uganda"
Description: "Central bank policies, regulations, job opportunities, and financial news in Uganda"
```

### 2. **Topic Scoping**
Once you select a topic, the AI automatically:

#### **A. Filters Web Search Results**
- When searching the web (via Tavily API), the topic name is added to the search query
- Results are post-filtered to ensure they're relevant to your topic
- **Example**: If your topic is "Bank of Uganda" and you ask "any new jobs?", the search will prioritize results about Bank of Uganda jobs, not general job listings

#### **B. Filters Document Search**
- When searching your uploaded documents, only documents tagged with that topic are searched
- This ensures the AI only uses relevant documents for context
- **Example**: If you have 100 documents but only 10 are about "Bank of Uganda", only those 10 are searched when that topic is selected

#### **C. Enhances AI Prompts**
- The AI receives context about your selected topic
- The system prompt includes: "You are answering questions about [Topic Name]. Focus on information relevant to this topic."
- This helps the AI generate more focused, relevant answers

#### **D. Organizes Conversations**
- Each conversation can be linked to a topic
- This helps you organize your chat history by subject
- You can filter conversations by topic to find past discussions

---

## Key Benefits to Users

### 1. **🎯 More Relevant Answers**
**Problem Solved**: Without topics, the AI might search broadly and return generic or irrelevant information.

**Solution**: Topics ensure the AI focuses on your specific area of interest, dramatically improving answer quality.

**Example:**
- **Without Topic**: "What are the latest job opportunities?" → Returns jobs from all industries worldwide
- **With Topic "Bank of Uganda"**: "What are the latest job opportunities?" → Returns only Bank of Uganda job listings

### 2. **📚 Better Document Organization**
**Problem Solved**: As you upload more documents, finding relevant ones becomes difficult.

**Solution**: Topics act as tags/categories for your documents, making it easy to:
- Upload documents to specific topics
- Search only relevant documents when asking questions
- Organize large document libraries

**Example:**
- You have 500 documents about various subjects
- When asking about "Bank of Uganda policies", only documents tagged with that topic are searched
- Faster, more accurate results

### 3. **🔍 Improved Search Precision**
**Problem Solved**: Web search can return too many irrelevant results.

**Solution**: Topics add context to search queries and filter results, ensuring only relevant information is retrieved.

**Example:**
- **Search Query**: "latest news"
- **Without Topic**: Returns news about everything (sports, politics, tech, etc.)
- **With Topic "Uganda Politics"**: Returns only political news from Uganda

### 4. **💬 Organized Conversation History**
**Problem Solved**: All conversations are mixed together, making it hard to find past discussions.

**Solution**: Conversations are linked to topics, allowing you to:
- Filter conversations by topic
- Quickly find past discussions about specific subjects
- Maintain context across related conversations

**Example:**
- You have 50 conversations about various topics
- Filter by "Bank of Uganda" to see only conversations about that topic
- Easily continue previous discussions

### 5. **🚀 Enhanced AI Context**
**Problem Solved**: The AI doesn't know what domain you're interested in, leading to generic answers.

**Solution**: Topics provide domain-specific context to the AI, helping it:
- Understand your area of interest
- Generate more specialized answers
- Use appropriate terminology and examples

**Example:**
- **Question**: "What are the requirements?"
- **Without Topic**: Generic answer about requirements in general
- **With Topic "Bank of Uganda Jobs"**: Specific answer about Bank of Uganda job requirements

### 6. **🔐 Topic-Scoped API Access**
**Problem Solved**: When sharing API access, you want to limit what others can query.

**Solution**: API keys can be scoped to specific topics, ensuring:
- Third-party integrations only access relevant information
- Better security and access control
- Usage tracking per topic

**Example:**
- You create an API key scoped to "Bank of Uganda"
- External applications can only query information about that topic
- They cannot access your other topics or documents

### 7. **🤖 Embeddable Chatbots**
**Problem Solved**: You want to embed a chatbot on your website, but it should only answer questions about your specific domain.

**Solution**: Embeddable chatbots are linked to topics, ensuring:
- The chatbot only answers questions relevant to that topic
- Better user experience for website visitors
- Focused, accurate responses

**Example:**
- You create an embeddable chatbot for "Bank of Uganda"
- Embed it on your website
- Visitors can ask questions, and the chatbot only provides information about Bank of Uganda

---

## Real-World Use Cases

### Use Case 1: **Financial Institution**
**Scenario**: You work at a bank and need to stay updated on central bank policies and regulations.

**Solution**:
1. Create topic: "Bank of Uganda"
2. Upload relevant documents (policies, regulations, circulars)
3. Ask questions like:
   - "What are the latest monetary policy changes?"
   - "Any new job openings at Bank of Uganda?"
   - "What are the current interest rates?"

**Benefits**:
- All answers focus on Bank of Uganda
- No irrelevant information from other banks or countries
- Documents are automatically filtered to relevant ones

### Use Case 2: **News Organization**
**Scenario**: You're a journalist covering multiple beats (politics, sports, technology).

**Solution**:
1. Create topics: "Uganda Politics", "Uganda Sports", "Uganda Technology"
2. For each story, select the appropriate topic
3. Ask questions like:
   - "What are the latest political developments?" (with "Uganda Politics" topic)
   - "Any recent sports news?" (with "Uganda Sports" topic)

**Benefits**:
- Organized conversations by beat
- Focused search results per topic
- Easy to find past stories by topic

### Use Case 3: **Research Organization**
**Scenario**: You're researching multiple projects simultaneously.

**Solution**:
1. Create topics for each research project
2. Upload project-specific documents to each topic
3. Ask questions within each topic's context

**Benefits**:
- Clear separation between research projects
- No cross-contamination of information
- Organized document library

### Use Case 4: **Customer Support**
**Scenario**: You want to embed a chatbot on your website that answers questions about your products.

**Solution**:
1. Create topic: "Product Information"
2. Upload product documentation, FAQs, manuals
3. Create an embeddable chatbot linked to this topic
4. Embed on your website

**Benefits**:
- Chatbot only answers product-related questions
- Uses your documentation for accurate answers
- Better customer experience

### Use Case 5: **Educational Institution**
**Scenario**: You're a teacher creating study materials for different subjects.

**Solution**:
1. Create topics: "Mathematics", "History", "Science"
2. Upload subject-specific materials to each topic
3. Students can ask questions within each subject's context

**Benefits**:
- Organized by subject
- Students get focused answers
- Easy to manage multiple subjects

---

## How to Use Topics

### Step 1: Create a Topic
1. Go to Dashboard → Topics tab
2. Click "New Topic"
3. Enter a name (e.g., "Bank of Uganda")
4. Optionally add a description
5. Click "Create"

### Step 2: Select a Topic
1. In the Chat Interface, you'll see a topic selector dropdown
2. Select your topic from the list
3. The selected topic will be highlighted

### Step 3: Ask Questions
1. With a topic selected, ask your question
2. The AI will automatically:
   - Filter web search to your topic
   - Search only relevant documents
   - Generate topic-focused answers

### Step 4: Organize Documents
1. When uploading documents, you can tag them with a topic
2. Documents tagged with a topic are automatically filtered when that topic is selected

### Step 5: Review Conversations
1. Conversations are automatically linked to the selected topic
2. Filter conversations by topic to find past discussions

---

## Technical Details

### How Topics Filter Information

#### **Web Search Filtering**
```typescript
// Topic name is added to search query
searchQuery = `"${topicName}" ${userQuestion}`

// Results are post-filtered to ensure relevance
results = results.filter(result => 
  result.content.includes(topicName.toLowerCase())
)
```

#### **Document Search Filtering**
```typescript
// Only documents with matching topicId are searched
PineconeService.search(query, {
  userId: userId,
  topicId: selectedTopicId,  // Filters documents
  topK: 5
})
```

#### **AI Prompt Enhancement**
```typescript
// System prompt includes topic context
systemPrompt = `
You are answering questions about ${topicName}.
Focus on information relevant to this topic.
...
`
```

---

## Best Practices

### 1. **Use Specific Topic Names**
- ✅ Good: "Bank of Uganda", "Uganda Politics", "Renewable Energy in Kenya"
- ❌ Bad: "General", "Stuff", "Misc"

### 2. **Create Topics for Major Areas of Interest**
- Don't create too many topics (hard to manage)
- Don't create too few topics (less effective filtering)
- Aim for 3-10 topics per user

### 3. **Add Descriptions**
- Helpful descriptions make topics more useful
- Describe what the topic covers
- Include keywords that might be used in searches

### 4. **Tag Documents Appropriately**
- When uploading documents, assign them to relevant topics
- This ensures better search results
- Organizes your document library

### 5. **Use Topics Consistently**
- Select a topic before asking questions
- This ensures all answers are focused
- Maintains conversation organization

---

## Summary

**Topics** are a powerful feature that:
- ✅ Focus AI searches on specific domains
- ✅ Organize documents and conversations
- ✅ Improve answer relevance and accuracy
- ✅ Enable topic-scoped API access
- ✅ Support embeddable chatbots
- ✅ Enhance overall user experience

**Key Takeaway**: Topics transform QueryAI from a general-purpose AI assistant into a specialized, domain-focused knowledge system tailored to your specific needs.

---

## Questions?

If you have questions about topics or need help setting them up, refer to:
- Dashboard → Topics tab (create and manage topics)
- Chat Interface (select topics when asking questions)
- Document Manager (tag documents with topics)
- API Keys Manager (scope API keys to topics)
- Embeddings Manager (create topic-scoped chatbots)
