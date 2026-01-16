# Ollama Local LLM Setup for AutoSort+

## Overview
AutoSort+ now supports **Ollama** - a local LLM solution that allows you to process emails completely offline without sending data to external servers!

## Benefits
- ✅ **100% Free** - No API costs, no subscriptions
- ✅ **Complete Privacy** - All email processing happens locally on your machine
- ✅ **No Rate Limits** - Process unlimited emails
- ✅ **Offline Capable** - Works without internet connection
- ✅ **Multiple Models** - Choose from Llama, Mistral, Phi, Gemma, and more

## Installation

### 1. Install Ollama
Download and install Ollama from: https://ollama.ai/download

Available for:
- **Linux** - `curl -fsSL https://ollama.ai/install.sh | sh`
- **macOS** - Download from website
- **Windows** - Download from website

### 2. Quick Start (Linux/macOS)
Copy and paste this command into a terminal to automatically set up Ollama with a model:

```bash
export OLLAMA_NO_GPU=1 OLLAMA_NO_AVX=1 && \
# Stop any running Ollama server
pkill -f "ollama serve" 2>/dev/null || true && sleep 2 && \
# Pull tinyllama model (skip if already downloaded)
ollama pull tinyllama && \
# Start Ollama server in background
nohup ollama serve > /tmp/ollama.log 2>&1 & sleep 5 && \
# Wait until the server is ready
echo "Waiting for Ollama server to start..." && \
until curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do sleep 2; done && \
echo "Ollama server is ready!" && \
# Send a test chat request
curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model":"tinyllama",
    "messages":[{"role":"user","content":"Classify this email: Hello world"}],
    "stream":false
  }' | jq -r '.message.content // .'
```

**What this does**:
- Sets CPU-only mode (if you have GPU, remove `OLLAMA_NO_GPU=1` and `OLLAMA_NO_AVX=1`)
- Stops any existing Ollama instances
- Downloads `tinyllama` (lightweight, ~1.4GB)
- Starts Ollama in the background
- Waits for the server to be ready
- Tests the connection with a sample email classification

### 3. Manual Setup (or for Windows)
If you prefer manual steps or use Windows:

```bash
# Download a model
ollama pull tinyllama  # Ultra-lightweight (1.4GB)
ollama pull phi        # Very fast (2GB)
ollama pull llama3.2   # Balanced (2GB, recommended)

# Start Ollama server
ollama serve

# In another terminal, verify it's running
curl http://localhost:11434/api/tags
```

### 4. Verify Installation
List installed models:

```bash
ollama list
```

You should see your downloaded model listed.

## Configuration in AutoSort+

### 1. Open Extension Settings
- Click the AutoSort+ icon in Thunderbird
- Or go to Tools → Add-ons → AutoSort+ → Options

### 2. Select Ollama
1. In the "AI Provider" dropdown, select **Ollama (Local LLM)**
2. Verify the Server URL is `http://localhost:11434` (default)
3. **Optional**: Check "Force CPU-only mode" if you want to disable GPU acceleration
4. Select your model from the dropdown (e.g., `llama3.2`)
5. Click **"Test Ollama Connection"** to verify it's working

### 3. Configure Labels/Folders
- Click **"Load Folders from Mail Account"** to import your existing folders
- Or manually add custom labels

### 4. Save Settings
Click **"Save Settings"** to apply your configuration

## Usage

### Processing Emails
1. Select one or more emails in Thunderbird
2. Right-click and choose **"AutoSort+ Analyze & Move"**
3. The extension will:
   - Send the email content to your local Ollama instance
   - Get AI classification results
   - Automatically move the email to the appropriate folder

### Model Selection
Different models have different characteristics:

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| llama3.2 | ~2GB | Fast | High | General use (recommended) |
| mistral | ~4GB | Medium | High | Detailed analysis |
| phi | ~2GB | Very Fast | Good | Quick processing |
| gemma | ~2GB | Fast | High | General use |
| qwen2.5 | ~3GB | Fast | Excellent | High accuracy |

## Troubleshooting

### Connection Failed
**Problem**: "Connection failed: Is Ollama running?"

**Solutions**:
1. Check if Ollama is running:
   ```bash
   ps aux | grep ollama
   ```
2. Start Ollama service:
   ```bash
   ollama serve
   ```
3. Verify it's accessible:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Model Not Found
**Problem**: "Model not found. Try 'ollama pull llama3.2' first."

**Solution**:
1. Pull the model manually:
   ```bash
   ollama pull llama3.2
   ```
2. Verify it's installed:
   ```bash
   ollama list
   ```

### CPU-Only Mode
**When to use CPU-only mode**:
- You don't have a compatible GPU
- You want to save GPU resources for other tasks
- You're experiencing GPU-related errors

**How to enable**:
1. In Ollama settings, check "Force CPU-only mode"
2. Save settings
3. Note: CPU processing will be slower than GPU

**Performance impact**:
- GPU mode: Typically 2-10x faster
- CPU mode: Slower but still functional

### Using Custom Port
If you're running Ollama on a different port:
1. Update the **Ollama Server URL** field to your custom URL
2. Example: `http://localhost:8080`

### Using Custom Model
If you want to use a model not in the dropdown:
1. Select **"Custom (enter below)"** from the model dropdown
2. Enter your custom model name in the text field that appears
3. Example: `codellama`, `llama2:13b`, `mistral:instruct`

## Performance Tips

### For Best Speed
- Use `phi` or `llama3.2` models (smaller, faster)
- Enable GPU mode (uncheck "Force CPU-only mode")
- Close other resource-intensive applications
- Consider GPU acceleration if available (CUDA/ROCm)

### For Best Accuracy
- Use `qwen2.5` or `mistral` models (larger, more accurate)
- Ensure you have sufficient RAM (8GB+ recommended)
- GPU mode recommended for larger models

### GPU vs CPU Mode
**GPU Mode** (default):
- ✅ 2-10x faster processing
- ✅ Better for frequent email processing
- ❌ Requires compatible GPU (NVIDIA/AMD)
- ❌ Uses GPU resources

**CPU-Only Mode**:
- ✅ Works on any system
- ✅ Frees up GPU for other tasks
- ✅ More predictable resource usage
- ❌ Slower processing (still usable)

### System Requirements
- **Minimum**: 4GB RAM, 5GB disk space
- **Recommended**: 8GB+ RAM, 10GB+ disk space
- **For GPU mode**: NVIDIA GPU with CUDA or AMD GPU with ROCm
- **For CPU-only mode**: Modern multi-core CPU (4+ cores recommended)

## Comparison with Cloud Providers

| Feature | Ollama (Local) | Gemini/OpenAI (Cloud) |
|---------|----------------|----------------------|
| Cost | Free | $5-20/month or rate limited |
| Privacy | Complete | Data sent to external servers |
| Speed | Fast (local) | Depends on internet |
| Rate Limits | None | 5-30 requests/min |
| Offline | ✅ Yes | ❌ No |
| Setup | Install software | Get API key |

## Advanced Configuration

### Multiple Ollama Instances
You can run multiple Ollama instances on different ports and switch between them in the settings.

### Custom Models
Pull any model from the Ollama library:
```bash
ollama pull <model-name>
```
Browse models at: https://ollama.ai/library

## Support
For Ollama-specific issues, visit:
- Ollama Documentation: https://github.com/ollama/ollama
- AutoSort+ Issues: (your issue tracker)

---

**Note**: First-time model downloads may take several minutes depending on your internet connection. Once downloaded, all processing happens locally and offline.
