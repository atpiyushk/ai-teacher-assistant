FROM python:3.11-slim

WORKDIR /app

# Install MCP server dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    openai \
    anthropic \
    google-generativeai \
    httpx \
    pydantic

# Copy MCP server code
COPY . .

# Run as non-root user
RUN useradd -m -u 1000 mcpuser && chown -R mcpuser:mcpuser /app
USER mcpuser

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]