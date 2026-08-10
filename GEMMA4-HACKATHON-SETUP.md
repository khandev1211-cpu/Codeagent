# Gemma 4 + Codeagent Hackathon Setup Guide

## 🎯 Overview

This guide provides everything you need to demonstrate **Gemma 4 running locally via Ollama** with **Codeagent** for your hackathon. The setup includes:

- ✅ Local Gemma 4 model via Ollama
- ✅ Full Codeagent integration with tool calling
- ✅ Custom subagents for code review workflows
- ✅ Demo scripts and commands

## 🚀 Quick Start

### 1. Install Prerequisites

```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.com/install.sh | sh

# Install Codeagent (if not already installed)
npm install -g codeagent
```

### 2. Pull Gemma 4 Model

```bash
# Pull the specific Gemma 4 model for the hackathon
ollama pull gemma4:e2b

# Start Ollama server (usually runs automatically after install)
ollama serve
```

### 3. Verify Setup

```bash
# Check that the model is available
curl http://localhost:11434/api/tags

# Should show: {"models":[{"name":"gemma4:e2b","size":...}]}
```

## 🔧 Configuration

### Codeagent + Ollama Setup

The Ollama provider is **already configured** in Codeagent:

- **Provider**: `ollama`
- **Model**: `gemma4:e2b` (or any Ollama model)
- **Base URL**: `http://localhost:11434` (configurable via `ollamaBaseUrl`)
- **API Key**: Not required (local service)

### Configuration Files

1. **Ollama Provider**: `src/providers/ollama.js`
   - Extends `OpenAiCompatibleProvider`
   - Uses Ollama's OpenAI-compatible `/v1/chat/completions` endpoint
   - No API key required

2. **Configuration Schema**: `src/config/schema.js`
   - `ollama` is already in the provider enum
   - `ollamaBaseUrl` config option available

## 🤖 Subagent Workflow

### Available Subagents

Two custom subagents are configured for your demo:

1. **🔍 Reviewer Subagent** (`.codeagent/agents/reviewer.md`)
   - Analyzes code for bugs, security issues, and best practices
   - Tools: `read_file`, `search_code`, `list_dir`
   - Output: Structured code review reports

2. **🔧 Fixer Subagent** (`.codeagent/agents/fixer.md`)
   - Proposes solutions for identified issues
   - Tools: `read_file`, `write_file`, `edit_file`, `search_code`, `list_dir`
   - Output: Concrete fix implementations

### Demo Commands

```bash
# Basic interaction
codeagent --provider ollama --model gemma4:e2b "explain what this function does"

# Code analysis with reviewer subagent
codeagent --provider ollama --model gemma4:e2b "use the reviewer subagent to analyze src/cli/index.js for potential issues"

# Fix implementation with fixer subagent
codeagent --provider ollama --model gemma4:e2b "use the fixer subagent to propose fixes for any issues found in src/cli/index.js"

# Full workflow delegation
codeagent --provider ollama --model gemma4:e2b "review and fix the code in src/cli/index.js using the appropriate subagents"
```

## 🧪 Smoke Testing

Run the comprehensive smoke test:

```bash
# Make the test script executable
chmod +x gemma4-smoke-test.sh

# Run all tests
./gemma4-smoke-test.sh
```

The test verifies:
- ✅ Ollama service availability
- ✅ Gemma 4 model availability
- ✅ Basic Codeagent communication
- ✅ Tool calling functionality
- ✅ Subagent discovery and execution

## 🎯 Hackathon Demo Script

### 5-Minute Demo Flow

```bash
# 1. Introduction (1 min)
echo "Today I'll demonstrate Gemma 4 running locally with Codeagent..."
echo "This shows how open-source models can power advanced coding agents!"

# 2. Basic functionality (1 min)
codeagent --provider ollama --model gemma4:e2b --yolo "What programming language is this project written in?"

# 3. Tool calling demo (1 min)
codeagent --provider ollama --model gemma4:e2b --yolo "Read package.json and tell me the project name and version"

# 4. Subagent workflow (2 min)
codeagent --provider ollama --model gemma4:e2b --yolo "Use the reviewer subagent to analyze src/cli/index.js for any potential issues"
```

## ⚠️ Important Notes

### Function Calling Compatibility

**Critical Information**: The success of this demo depends on **Gemma 4's function calling support via Ollama**.

- **If it works**: You'll see seamless tool execution (file reading, writing, etc.)
- **If it doesn't work**: Tools won't execute properly, and you'll need to adjust your demo

**How to check**:
```bash
# Test function calling directly
codeagent --provider ollama --model gemma4:e2b --yolo "read the README.md file and summarize the first 3 features"
```

**Fallback plan**: If function calling doesn't work reliably:
1. Focus on the **basic chat capabilities** of Gemma 4
2. Highlight the **architecture and potential** of the system
3. Show **manual tool execution** as a comparison
4. Mention that **function calling is a model capability** that varies by implementation

## 🔧 Troubleshooting

### Common Issues

**Ollama not running**:
```bash
ollama serve
```

**Model not found**:
```bash
ollama pull gemma4:e2b
```

**Permission issues**:
```bash
# Run with --yolo for demo (remove for production)
codeagent --provider ollama --model gemma4:e2b --yolo "your command"
```

**Connection refused**:
```bash
# Check if Ollama is running on the right port
curl -v http://localhost:11434
```

## 📚 Technical Details

### Architecture Flow

```
User Command → Codeagent CLI → Orchestrator → Ollama Provider → Local Gemma 4 → Response
                                      ↓
                                Tool Registry → File/System Tools
```

### Key Files Modified/Created

- `.codeagent/agents/reviewer.md` - Reviewer subagent definition
- `.codeagent/agents/fixer.md` - Fixer subagent definition
- `gemma4-smoke-test.sh` - Comprehensive test script
- `GEMMA4-HACKATHON-SETUP.md` - This guide

### No Core Code Changes Needed

The existing Codeagent architecture already supports:
- ✅ Ollama provider with configurable base URL
- ✅ Arbitrary model names (including `gemma4:e2b`)
- ✅ No API key requirement for local providers
- ✅ Full tool calling infrastructure
- ✅ Subagent system with isolation

## 🎉 Demo Success Criteria

**Minimum Viable Success**:
- [ ] Ollama runs Gemma 4 locally
- [ ] Codeagent connects to Ollama without errors
- [ ] Basic text responses work
- [ ] Subagent definitions are discovered

**Full Success**:
- [ ] Tool calling works (file operations execute)
- [ ] Subagents can be invoked and complete tasks
- [ ] End-to-end workflow runs smoothly

## 📋 Checklist Before Hackathon

- [ ] ✅ Ollama installed and running
- [ ] ✅ Gemma 4 model pulled (`gemma4:e2b`)
- [ ] ✅ Codeagent installed globally
- [ ] ✅ Subagent files created
- [ ] ✅ Smoke test script ready
- [ ] ✅ Demo commands practiced
- [ ] ✅ Fallback plan prepared (in case function calling has issues)
- [ ] ✅ Laptop charged and ready!

---

**Good luck with your hackathon!** 🚀

This setup demonstrates the power of open-source AI models running locally with sophisticated agent frameworks. Whether the function calling works perfectly or needs some adjustment, you're showing cutting-edge technology in action.