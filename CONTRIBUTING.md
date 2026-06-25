# Contributing to NeuralForge

Thank you for your interest in contributing to NeuralForge! We welcome pull requests, bug reports, and suggestions.

---

## Code Style & Standards

### Backend (Python/FastAPI)

- Follow **PEP 8** standards.
- Use **black** or **ruff** for formatting.
- Keep all endpoint handlers asynchronous (`async def`).
- Write type hints for all parameters in schemas and function definitions.

### Frontend (Next.js/React)

- Follow standard React hooks rules.
- Maintain CSS variables inside `globals.css` rather than writing ad-hoc utility selectors.
- Verify elements support both dark and light modes cleanly.
- Ensure unique IDs exist on interactive buttons for automated testing.

---

## Development Workflow

1. Fork this repository and create a branch:
   ```bash
   git checkout -b feature/your-awesome-feature
   ```
2. Setup and run local servers (see the [README](README.md) file).
3. Test your changes locally:
   - Backend: run `pytest` inside the backend directory.
   - Frontend: run `npm run lint` and `npm run build` to verify Next.js compilations.
4. Open a Pull Request with a clear explanation of changes!
