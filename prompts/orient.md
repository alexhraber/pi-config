---
description: Orient a task through Decapod before acting
argument-hint: "[intent]"
---
Before making changes, use Decapod to orient this work. Preserve the user's intent, identify ambiguity and boundaries, state assumptions, define proof expectations, and stop for a human decision if Decapod emits a Decision Gate.

Intent: ${@:-the current task}

Return a concise working brief with: intent, scope, risks, relevant context, next governed action, and verification plan.
