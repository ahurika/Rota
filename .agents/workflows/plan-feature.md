# /plan-feature

Plan one Rota feature before writing code. Use at the start of every task.

1. Read `PRD.md` and find the requirement IDs this task covers (for example FR-F2, FR-B4).
2. List the matching skills in `.agents/skills/` and read them.
3. Write a plan in 10 lines or fewer:
   - Goal in one sentence
   - Files you will create or change
   - Database changes (migration names)
   - Endpoints and their Zod schemas and required permission
   - Tests you will write first (name them by test id where one exists)
   - Docs to update
   - Risks and one thing you are unsure about
4. Ask the human to confirm or change the plan. Do not start coding before they answer.
5. After confirmation, create the branch (`feat/<name>`) and work in small commits.
