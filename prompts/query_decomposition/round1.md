# Stage 1: Orchestrator - skeleton generation
STAGE_1_PROMPT_TEMPLATE = """
You are the Research Orchestrator. Analyze the provided Abstract and
immediately generate a 'Publication Skeleton'.
Break the research down into 3 orthogonal search dimensions. Assign the most
suitable Expert Persona and Tool Strategy for each dimension.
Output strictly in JSON format.

Abstract:
{abstract}

Output Format:
{{
    "skeleton_plan": [
        {{
            "bone_id": "method_vector",
            "focus_area": "Methodology",
            "assigned_persona": "Senior_Algorithm_Engineer",
            "tool_strategy": "Doc2Query",
            "instruction": "Focus strictly on model architecture."
        }},
        ...
    ]
}}
"""