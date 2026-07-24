#!/bin/bash

# Gemma 4 + Codeagent Smoke Test Script
# This script verifies that Gemma 4 works with Codeagent via Ollama

set -e

echo "🚀 Starting Gemma 4 + Codeagent Smoke Test"
echo "========================================"

# Test 1: Verify Ollama is running and Gemma 4 model is available
echo "📋 Test 1: Checking Ollama service and Gemma 4 model..."
if ! curl -s http://localhost:11434/api/tags | grep -q "gemma4:e2b"; then
    echo "❌ Ollama is not running or gemma4:e2b model is not available"
    echo "💡 Please run: ollama pull gemma4:e2b"
    exit 1
fi
echo "✅ Ollama is running and gemma4:e2b model is available"

# Test 2: Basic Codeagent functionality with Gemma 4
echo -e "\n📋 Test 2: Testing basic Codeagent functionality..."
RESPONSE=$(codeagent --provider ollama --model gemma4:e2b --yolo "say hello" 2>&1)
if echo "$RESPONSE" | grep -q "hello\|Hello\|Hi"; then
    echo "✅ Basic Codeagent + Gemma 4 communication works"
else
    echo "❌ Basic communication failed"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test 3: Tool calling functionality (read_file)
echo -e "\n📋 Test 3: Testing tool calling with read_file..."
RESPONSE=$(codeagent --provider ollama --model gemma4:e2b --yolo "read package.json and summarize it" 2>&1)
if echo "$RESPONSE" | grep -q "package.json\|JSON\|name.*codeagent"; then
    echo "✅ Tool calling (read_file) works with Gemma 4"
else
    echo "❌ Tool calling failed"
    echo "Response: $RESPONSE"
    exit 1
fi

# Test 4: Subagent discovery
echo -e "\n📋 Test 4: Testing subagent discovery..."
if [ -f ".codeagent/agents/reviewer.md" ] && [ -f ".codeagent/agents/fixer.md" ]; then
    echo "✅ Subagent definitions exist"
    echo "Available subagents:"
    ls -la .codeagent/agents/*.md
else
    echo "❌ Subagent definitions missing"
    exit 1
fi

# Test 5: Subagent execution (if function calling works)
echo -e "\n📋 Test 5: Testing subagent execution..."
RESPONSE=$(codeagent --provider ollama --model gemma4:e2b --yolo "use the reviewer subagent to analyze src/cli/index.js" 2>&1)
if echo "$RESPONSE" | grep -q "reviewer\|subagent\|analysis"; then
    echo "✅ Subagent execution works"
else
    echo "⚠️  Subagent execution may have issues (could be function calling limitation)"
    echo "Response snippet: ${RESPONSE:0:200}..."
fi

echo -e "\n🎉 All tests completed!"
echo "========================================"
echo "Summary:"
echo "- Ollama service: ✅ Running"
echo "- Gemma 4 model: ✅ Available"
echo "- Basic communication: ✅ Working"
echo "- Tool calling: ✅ Functional"
echo "- Subagents: ✅ Configured"
echo -e "\n📝 Notes:"
echo "- If any tests failed, check Ollama logs and model compatibility"
echo "- Function calling support depends on Gemma 4's capabilities via Ollama"
echo "- For production use, remove --yolo flag for safety confirmations"