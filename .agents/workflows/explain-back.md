# /explain-back

Help the human learn what was just built. The human must be able to explain every line in an interview.

1. Name the 2 or 3 most important lines or functions from the last task.
2. For each, give a 2 sentence explanation using a simple analogy and the exact failure it prevents.
3. Ask these questions one at a time and wait for the human's answer each time:
   - What problem does this code solve?
   - What would break if this line were removed? Give a concrete example.
   - What would an attacker or a failure do to this code?
4. Mark the answer: correct, partly correct, or wrong. If partly correct or wrong, explain the gap briefly and ask again in a different way.
5. Ask one interview-style question from `PRD.md` section 15 that relates to this task.
6. End by reminding the human to close this chat and write a short paragraph in `LEARNING-LOG.md` in their own words. Do not write it for them.
