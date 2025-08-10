from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
import os
import logging
from datetime import datetime
import asyncio
import json

# LLM providers
import openai
import anthropic
import google.generativeai as genai
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MCP Server - Multi-LLM Gateway", version="1.0.0")

# Initialize LLM clients
openai_client = None
azure_openai_client = None
anthropic_client = None
gemini_model = None


class LLMRequest(BaseModel):
    model: str = Field(..., description="Model identifier (e.g., gpt-4, claude-3-opus, gemini-pro)")
    messages: List[Dict[str, str]] = Field(..., description="Conversation messages")
    temperature: float = Field(0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, description="Maximum tokens to generate")
    system_prompt: Optional[str] = Field(None, description="System prompt for the model")
    stream: bool = Field(False, description="Stream the response")


class LLMResponse(BaseModel):
    model: str
    content: str
    usage: Dict[str, int]
    latency_ms: int
    provider: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ModelInfo(BaseModel):
    id: str
    provider: str
    name: str
    description: str
    context_window: int
    max_output_tokens: int
    supports_vision: bool = False
    supports_functions: bool = False


# Available models configuration
AVAILABLE_MODELS = {
    # OpenAI Models
    "gpt-4-turbo": ModelInfo(
        id="gpt-4-turbo",
        provider="openai",
        name="GPT-4 Turbo",
        description="Most capable GPT-4 model with vision support",
        context_window=128000,
        max_output_tokens=4096,
        supports_vision=True,
        supports_functions=True
    ),
    "gpt-4": ModelInfo(
        id="gpt-4",
        provider="openai",
        name="GPT-4",
        description="Original GPT-4 model",
        context_window=8192,
        max_output_tokens=4096,
        supports_functions=True
    ),
    "gpt-3.5-turbo": ModelInfo(
        id="gpt-3.5-turbo",
        provider="openai",
        name="GPT-3.5 Turbo",
        description="Fast and efficient model for most tasks",
        context_window=16385,
        max_output_tokens=4096,
        supports_functions=True
    ),
    
    # Anthropic Models
    "claude-3-opus": ModelInfo(
        id="claude-3-opus-20240229",
        provider="anthropic",
        name="Claude 3 Opus",
        description="Most capable Claude model",
        context_window=200000,
        max_output_tokens=4096,
        supports_vision=True
    ),
    "claude-3-sonnet": ModelInfo(
        id="claude-3-sonnet-20240229",
        provider="anthropic",
        name="Claude 3 Sonnet",
        description="Balanced performance and speed",
        context_window=200000,
        max_output_tokens=4096,
        supports_vision=True
    ),
    "claude-3-haiku": ModelInfo(
        id="claude-3-haiku-20240307",
        provider="anthropic",
        name="Claude 3 Haiku",
        description="Fast and efficient Claude model",
        context_window=200000,
        max_output_tokens=4096,
        supports_vision=True
    ),
    
    # Google Models
    "gemini-pro": ModelInfo(
        id="gemini-pro",
        provider="google",
        name="Gemini Pro",
        description="Google's most capable model",
        context_window=32768,
        max_output_tokens=8192,
        supports_vision=False
    ),
    "gemini-pro-vision": ModelInfo(
        id="gemini-pro-vision",
        provider="google",
        name="Gemini Pro Vision",
        description="Gemini with vision capabilities",
        context_window=32768,
        max_output_tokens=8192,
        supports_vision=True
    ),
    
    # Azure OpenAI Models
    "azure-gpt-4": ModelInfo(
        id="gpt-4",
        provider="azure",
        name="Azure GPT-4",
        description="GPT-4 via Azure OpenAI",
        context_window=8192,
        max_output_tokens=4096,
        supports_functions=True
    ),
    "azure-gpt-35-turbo": ModelInfo(
        id="gpt-35-turbo",
        provider="azure",
        name="Azure GPT-3.5 Turbo",
        description="GPT-3.5 Turbo via Azure OpenAI",
        context_window=16385,
        max_output_tokens=4096,
        supports_functions=True
    )
}


@app.on_event("startup")
async def startup_event():
    """Initialize LLM clients on startup"""
    global openai_client, azure_openai_client, anthropic_client, gemini_model
    
    # Initialize OpenAI
    if os.getenv("OPENAI_API_KEY"):
        openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        logger.info("OpenAI client initialized")
    
    # Initialize Azure OpenAI
    if os.getenv("AZURE_OPENAI_API_KEY") and os.getenv("AZURE_OPENAI_ENDPOINT"):
        azure_openai_client = AsyncOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            api_version="2024-02-15-preview"
        )
        logger.info("Azure OpenAI client initialized")
    
    # Initialize Anthropic
    if os.getenv("ANTHROPIC_API_KEY"):
        anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        logger.info("Anthropic client initialized")
    
    # Initialize Google Gemini
    if os.getenv("GEMINI_API_KEY"):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        logger.info("Google Gemini initialized")


async def call_openai(request: LLMRequest) -> LLMResponse:
    """Call OpenAI API"""
    if not openai_client:
        raise HTTPException(status_code=503, detail="OpenAI client not initialized")
    
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Prepare messages
        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.extend(request.messages)
        
        # Make API call
        response = await openai_client.chat.completions.create(
            model=request.model,
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=False  # TODO: Implement streaming
        )
        
        # Calculate latency
        latency_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        
        return LLMResponse(
            model=request.model,
            content=response.choices[0].message.content,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            latency_ms=latency_ms,
            provider="openai"
        )
        
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")


async def call_azure_openai(request: LLMRequest) -> LLMResponse:
    """Call Azure OpenAI API"""
    if not azure_openai_client:
        raise HTTPException(status_code=503, detail="Azure OpenAI client not initialized")
    
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Prepare messages
        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})
        messages.extend(request.messages)
        
        # Use deployment name from model ID
        deployment_name = request.model.replace("azure-", "")
        
        # Make API call
        response = await azure_openai_client.chat.completions.create(
            model=deployment_name,  # Azure uses deployment names
            messages=messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            stream=False
        )
        
        # Calculate latency
        latency_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        
        return LLMResponse(
            model=request.model,
            content=response.choices[0].message.content,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            },
            latency_ms=latency_ms,
            provider="azure"
        )
        
    except Exception as e:
        logger.error(f"Azure OpenAI API error: {e}")
        raise HTTPException(status_code=500, detail=f"Azure OpenAI API error: {str(e)}")


async def call_anthropic(request: LLMRequest) -> LLMResponse:
    """Call Anthropic API"""
    if not anthropic_client:
        raise HTTPException(status_code=503, detail="Anthropic client not initialized")
    
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Prepare messages for Anthropic format
        system_prompt = request.system_prompt or "You are a helpful AI assistant."
        
        # Convert messages to Anthropic format
        anthropic_messages = []
        for msg in request.messages:
            anthropic_messages.append({
                "role": msg["role"] if msg["role"] != "system" else "assistant",
                "content": msg["content"]
            })
        
        # Make API call
        response = await anthropic_client.messages.create(
            model=request.model,
            messages=anthropic_messages,
            system=system_prompt,
            temperature=request.temperature,
            max_tokens=request.max_tokens or 4096
        )
        
        # Calculate latency
        latency_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        
        return LLMResponse(
            model=request.model,
            content=response.content[0].text,
            usage={
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            },
            latency_ms=latency_ms,
            provider="anthropic"
        )
        
    except Exception as e:
        logger.error(f"Anthropic API error: {e}")
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")


async def call_gemini(request: LLMRequest) -> LLMResponse:
    """Call Google Gemini API"""
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    
    start_time = asyncio.get_event_loop().time()
    
    try:
        # Initialize model
        model = genai.GenerativeModel(request.model)
        
        # Prepare conversation
        chat_history = []
        last_message = ""
        
        for msg in request.messages:
            if msg["role"] == "user":
                last_message = msg["content"]
            elif msg["role"] == "assistant":
                chat_history.append({"role": "user", "parts": [last_message]})
                chat_history.append({"role": "model", "parts": [msg["content"]]})
        
        # Start chat
        chat = model.start_chat(history=chat_history)
        
        # Generate response
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: chat.send_message(
                last_message,
                generation_config=genai.GenerationConfig(
                    temperature=request.temperature,
                    max_output_tokens=request.max_tokens
                )
            )
        )
        
        # Calculate latency
        latency_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)
        
        # Estimate token usage (Gemini doesn't provide exact counts)
        estimated_tokens = len(last_message.split()) + len(response.text.split())
        
        return LLMResponse(
            model=request.model,
            content=response.text,
            usage={
                "prompt_tokens": len(last_message.split()) * 2,  # Rough estimate
                "completion_tokens": len(response.text.split()) * 2,
                "total_tokens": estimated_tokens * 2
            },
            latency_ms=latency_ms,
            provider="google"
        )
        
    except Exception as e:
        logger.error(f"Gemini API error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


@app.post("/generate", response_model=LLMResponse)
async def generate(request: LLMRequest):
    """Generate text using specified LLM"""
    
    # Validate model
    if request.model not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Model '{request.model}' not available. Use /models endpoint to see available models."
        )
    
    model_info = AVAILABLE_MODELS[request.model]
    
    # Route to appropriate provider
    if model_info.provider == "openai":
        return await call_openai(request)
    elif model_info.provider == "azure":
        return await call_azure_openai(request)
    elif model_info.provider == "anthropic":
        return await call_anthropic(request)
    elif model_info.provider == "google":
        return await call_gemini(request)
    else:
        raise HTTPException(status_code=501, detail=f"Provider {model_info.provider} not implemented")


@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List all available models"""
    return list(AVAILABLE_MODELS.values())


@app.get("/models/{model_id}", response_model=ModelInfo)
async def get_model(model_id: str):
    """Get information about a specific model"""
    if model_id not in AVAILABLE_MODELS:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return AVAILABLE_MODELS[model_id]


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    providers_status = {
        "openai": openai_client is not None,
        "azure": azure_openai_client is not None,
        "anthropic": anthropic_client is not None,
        "google": bool(os.getenv("GEMINI_API_KEY"))
    }
    
    return {
        "status": "healthy",
        "service": "mcp-server",
        "providers": providers_status,
        "available_models": len(AVAILABLE_MODELS)
    }