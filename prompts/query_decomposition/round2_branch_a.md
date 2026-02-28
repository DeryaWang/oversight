# Stage 2: Persona - extend the query

STAGE_2_PROMPT_TEMPLATE = """
You are a {persona}. Your goal is to execute a SINGLE specific retrieval task
based on your assigned tool.

Context: {abstract}
Focus Area: {focus}
Assigned Tool: {tool}

!!! CRITICAL INSTRUCTION !!!
You must strictly follow the output format based on your 'Assigned Tool'.
Do NOT output explanations, do NOT output markdown headers (like ###), and do
NOT output both types.

---
[IF Assigned Tool == "Doc2Query"]
- Task: Transform the abstract into a specific search QUESTION that a
researcher would type into Google Scholar.
- Target: Focus on the technical details of the '{focus}'.
- Output Format: Just the question string. Nothing else.
- Example: "contrastive learning loss functions for multi-modal fusion"

[IF Assigned Tool == "HyDE_Citation"]
- Task: Predict 3-5 seminal PAPER TITLES that are foundational to this work.
- Target: List real, existing papers that are highly relevant to '{focus}'.
- Output Format: A single line of titles separated by semicolons.
- Example: "Attention Is All You Need; Graph Convolutional Networks; ResNet"
---

Your Output:
"""