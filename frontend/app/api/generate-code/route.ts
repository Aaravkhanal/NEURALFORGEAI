import { NextResponse } from 'next/server';

export interface GeneratedFiles {
  'inference.py': string;
  'app.py': string;
  'requirements.txt': string;
  'README.md': string;
}

export async function POST(req: Request) {
  try {
    const {
      problemDescription,
      modelFormat,
      modelName,
      taskType,
      featureNames,
      targetColumn,
      trainingMetrics,
      preprocessingInfo,
    } = await req.json();

    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        files: errorFiles('NVIDIA_API_KEY is not set in .env. Add your key to enable AI code generation.')
      });
    }

    const featuresBlock = Array.isArray(featureNames) && featureNames.length > 0
      ? `Feature names (exact, from training): [${featureNames.join(', ')}]`
      : 'Feature names: not available — use descriptive generic names based on the problem';

    const metricsBlock = trainingMetrics
      ? `Training metrics: ${JSON.stringify(trainingMetrics)}`
      : '';

    const preprocessBlock = preprocessingInfo
      ? `Preprocessing: ${preprocessingInfo}`
      : 'Preprocessing: label encoding for categoricals, median imputation for missing values';

    const loaderBlock = (() => {
      const fmt = (modelFormat || '.pkl').replace('.', '');
      if (fmt === 'onnx') return 'Load with onnxruntime.InferenceSession';
      if (fmt === 'pt' || fmt === 'pth') return 'Load with torch.load()';
      if (fmt === 'h5') return 'Load with tf.keras.models.load_model()';
      return 'Load with joblib.load()';
    })();

    const prompt = `You are a senior ML engineer. Generate a complete, production-ready Python inference package.

CONTEXT:
- Problem: ${problemDescription || 'Machine learning prediction task'}
- Model: ${modelName || 'Trained Model'} (${modelFormat || '.pkl'})
- Task type: ${taskType || 'tabular_classification'}
- Target column: ${targetColumn || 'target'}
- ${featuresBlock}
- ${metricsBlock}
- ${preprocessBlock}
- Model loading: ${loaderBlock}

Generate EXACTLY these 4 files. Return ONLY a valid JSON object — no markdown, no prose, just the JSON:

{
  "inference.py": "<complete Python inference script>",
  "app.py": "<complete FastAPI REST server>",
  "requirements.txt": "<one package per line>",
  "README.md": "<markdown setup and usage guide>"
}

REQUIREMENTS FOR EACH FILE:

inference.py:
- Top comment block listing pip packages needed
- load_model(path) function using ${loaderBlock}
- preprocess(df) that handles missing values and type casting using the exact feature names
- predict(df: pd.DataFrame) -> list returning predictions
- batch_predict(csv_path: str) reading CSV, saving results to predictions.csv
- Realistic sample_input dict with actual domain-appropriate values for each feature
- if __name__ == "__main__": runs the sample and prints prediction + confidence if available

app.py:
- FastAPI app with POST /predict endpoint
- Accepts JSON body with feature values, validates types
- Loads model once at startup using lifespan context
- Returns {"prediction": ..., "confidence": ..., "model": "${modelName || 'model'}"}
- GET /health endpoint
- CORS enabled for local dev

requirements.txt:
- All packages needed to run both inference.py and app.py
- Pin major versions (e.g., scikit-learn>=1.3, fastapi>=0.110)
- One package per line, no comments

README.md:
- ## Setup section with exact pip install command
- ## Quickstart showing how to run inference.py
- ## API section with curl example calling POST /predict
- ## Features table listing each feature name with its expected type
- Keep it concise and practical`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        files: errorFiles(`NVIDIA API error (${response.status}): ${errorText.slice(0, 200)}`)
      });
    }

    const data = await response.json();
    let raw = data.choices[0]?.message?.content || '';

    // Strip markdown fences if the LLM wrapped the JSON
    raw = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

    // Find the JSON object (in case there's preamble text)
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      raw = raw.slice(jsonStart, jsonEnd + 1);
    }

    let files: GeneratedFiles;
    try {
      const parsed = JSON.parse(raw);
      files = {
        'inference.py': cleanCode(parsed['inference.py'] || '# Not generated'),
        'app.py': cleanCode(parsed['app.py'] || '# Not generated'),
        'requirements.txt': (parsed['requirements.txt'] || '').trim(),
        'README.md': (parsed['README.md'] || '').trim(),
      };
    } catch {
      // JSON parse failed — return the raw text as inference.py and note the issue
      files = {
        'inference.py': cleanCode(raw),
        'app.py': '# Could not parse multi-file response\n# Click Regenerate to try again',
        'requirements.txt': 'scikit-learn>=1.3\npandas>=2.0\nnumpy>=1.24\njoblib>=1.3',
        'README.md': '# Setup\n\nClick **Regenerate** to re-generate all files.',
      };
    }

    return NextResponse.json({ files });

  } catch (error: any) {
    return NextResponse.json({ files: errorFiles(error.message) });
  }
}

function cleanCode(code: string): string {
  return code
    .replace(/^```(?:python|py)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
}

function errorFiles(message: string): GeneratedFiles {
  return {
    'inference.py': `# Error: ${message}`,
    'app.py': `# Error: ${message}`,
    'requirements.txt': '',
    'README.md': `# Error\n\n${message}`,
  };
}
