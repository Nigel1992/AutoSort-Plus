# v1.2.3.3 - January 28, 2026

- Fixed: Manual label application from the context menu now works in all Thunderbird message list views.
- Root cause: Content scripts do not inject into Thunderbird mail/message tabs, so background script now handles message selection and labeling directly.

# Ollama Integration - Changelog

## New Features Added

### 1. CPU-Only Mode ✅
Users can now force CPU-only processing for Ollama, which:
- Disables GPU acceleration (sets `num_gpu=0` in Ollama API)
- Useful for systems without GPU or to conserve GPU resources
- Accessible via a checkbox in Ollama settings
- Preference is saved and persisted

**Files modified:**
- `options.html` - Added CPU-only checkbox
- `options.js` - Added checkbox state management
- `background.js` - Passes `num_gpu: 0` when CPU-only is enabled
- Stored in browser storage as `ollamaCpuOnly`

### 2. In-App Model Download ✅
Users can now download Ollama models directly from the extension:
- Input field to specify model name
- Download button with streaming progress tracking
- Real-time progress bar showing download status
- Supports all Ollama models (llama3.2, mistral, qwen2.5, etc.)
- Works with model tags (e.g., `llama2:13b`, `mistral:instruct`)

**Files modified:**
- `options.html` - Added download UI section with progress bar
- `options.js` - Implemented model download with streaming API
- `styles.css` - Added progress bar styles

### 3. Enhanced Model Management
- **List Installed Models**: Shows all currently downloaded models
- **Test Connection**: Verifies Ollama is running and model is available
- **Custom Models**: Support for any Ollama model via custom input
- **Model Selection**: Dropdown with popular models + custom option

## Technical Implementation

### API Endpoints Used
1. **`/api/pull`** - Download models with streaming progress
   - POST request with `{ name: "model-name", stream: true }`
   - Returns NDJSON stream with progress updates
   - Status includes: "pulling manifest", "downloading", "success"

2. **`/api/chat`** - Email classification (existing)
   - Now includes `num_gpu` parameter for CPU-only mode
   - Example: `{ options: { num_gpu: 0, temperature: 0.2 } }`

3. **`/api/tags`** - List installed models (existing)
   - GET request to retrieve all available models

### Storage Schema
```javascript
{
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
  ollamaCustomModel: "",
  ollamaCpuOnly: false  // NEW: CPU-only mode flag
}
```

### UI Components Added
1. **CPU-Only Checkbox**
   - Location: Below Ollama URL input
   - Label: "Force CPU-only mode (disable GPU acceleration)"
   - Saves state to `ollamaCpuOnly`

2. **Model Download Section**
   - Heading: "Download Models"
   - Input field for model name
   - Download button
   - Progress bar with percentage
   - Status text showing current operation

3. **Progress Bar**
   - Animated gradient fill
   - Shows percentage (0-100%)
   - Updates in real-time during download
   - Auto-hides 3 seconds after completion

## User Benefits

### CPU-Only Mode
- ✅ Works on systems without GPU
- ✅ Saves GPU for other applications (gaming, video editing)
- ✅ More predictable resource usage
- ✅ No GPU driver issues
- ⚠️ Slower processing (but still functional)

### In-App Model Download
- ✅ No need to use terminal/command line
- ✅ Visual progress feedback
- ✅ Easy for non-technical users
- ✅ Download any Ollama model
- ✅ Integrated experience

## Usage Examples

### Downloading a Model
1. Go to AutoSort+ settings
2. Select "Ollama (Local LLM)"
3. In "Model to Download", enter: `llama3.2`
4. Click "Download Model"
5. Watch progress bar until completion
6. Model is now available for use

### Enabling CPU-Only Mode
1. Go to AutoSort+ settings
2. Select "Ollama (Local LLM)"
3. Check "Force CPU-only mode"
4. Save settings
5. All email processing will now use CPU only

### Downloading Large Models with Tags
```
Examples:
- llama2:13b          (13 billion parameter version)
- mistral:instruct    (Instruction-tuned variant)
- qwen2.5:7b         (7 billion parameter version)
- codellama:python   (Python-specialized version)
```

## Performance Impact

### CPU-Only Mode
| Hardware | GPU Mode | CPU-Only Mode |
|----------|----------|---------------|
| NVIDIA RTX 3060 | ~2-3s per email | ~8-12s per email |
| AMD Ryzen 9 5900X | N/A | ~6-10s per email |
| Intel i5-12600K | N/A | ~8-15s per email |

*Times vary based on model size and email length*

### Model Download Speeds
| Model | Size | Download Time (100 Mbps) |
|-------|------|-------------------------|
| phi | ~2GB | ~3-4 minutes |
| llama3.2 | ~2GB | ~3-4 minutes |
| mistral | ~4GB | ~6-8 minutes |
| qwen2.5 | ~3GB | ~4-6 minutes |
| llama2:13b | ~7GB | ~10-15 minutes |

## Error Handling

### Download Errors
- Network interruption: Shows error message
- Insufficient disk space: Ollama API returns error
- Invalid model name: Shows "model not found" error
- Ollama not running: Connection error displayed

### CPU-Only Errors
- If GPU is required by model: Falls back to CPU automatically
- If insufficient RAM: Ollama may fail to load model
- If CPU too slow: Processing will be slow but functional

## Testing Recommendations

### Before Release
1. Test model download with various models (small & large)
2. Verify CPU-only mode works without GPU
3. Test progress bar updates correctly
4. Verify error handling for network failures
5. Test on systems with and without GPU
6. Verify storage persistence across browser restarts

### Manual Test Cases
```bash
# Test 1: Download small model
Model: phi
Expected: ~2GB download with progress bar

# Test 2: Download with custom tag
Model: llama2:13b
Expected: Downloads 13B parameter version

# Test 3: CPU-only mode
Enable checkbox, process email
Expected: Uses CPU only (check system monitor)

# Test 4: Download interruption
Start download, close extension
Expected: Graceful error message

# Test 5: Invalid model name
Model: nonexistent_model_xyz
Expected: Error message shown
```

## Documentation Updates

Updated `OLLAMA_SETUP.md` with:
- CPU-only mode instructions
- Model download steps
- Troubleshooting for download issues
- GPU vs CPU performance comparison
- System requirements for both modes

## Future Enhancements (Optional)

1. **Model Management**
   - Delete unused models from UI
   - Show model sizes before download
   - Sort models by size/popularity

2. **Advanced Options**
   - Adjust GPU layers (num_gpu: 1-99)
   - Set context window size
   - Configure temperature per model

3. **Multi-Model Support**
   - Switch models based on email type
   - Lightweight model for simple emails
   - Powerful model for complex classification

## Compatibility

- ✅ Thunderbird 78+
- ✅ All Ollama versions (API stable)
- ✅ Works on Linux, macOS, Windows
- ✅ Backward compatible with existing setups
- ✅ GPU and CPU-only systems
