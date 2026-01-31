# n8n TOON Converter Node - Implementation Plan

## Overview
Create a custom n8n node that converts incoming JSON items to TOON (Token-Oriented Object Notation) format to reduce token usage when sending data to LLMs. Each item is converted separately with metadata about token savings.

## Project Structure
```
toon/
├── package.json
├── tsconfig.json
├── nodes/
│   └── ToToon/
│       ├── ToToon.node.ts      # Main node implementation
│       └── toon.svg            # Node icon
└── dist/                        # Build output
```

## Files to Create

### 1. `package.json`
```json
{
  "name": "n8n-nodes-toon",
  "version": "1.0.0",
  "description": "n8n node to convert JSON to TOON format for reduced LLM token usage",
  "license": "MIT",
  "author": { "name": "Diego" },
  "n8n": {
    "n8nNodesApiVersion": 1,
    "nodes": ["dist/nodes/ToToon/ToToon.node.js"]
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "@toon-format/toon": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "n8n-workflow": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 2. `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": ".",
    "declaration": true
  },
  "include": ["nodes/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. `nodes/ToToon/ToToon.node.ts`
```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { encode } from '@toon-format/toon';

export class ToToon implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'To TOON',
    name: 'toToon',
    icon: 'file:toon.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Convert to TOON format',
    description: 'Convert JSON items to TOON format for reduced LLM token usage',
    defaults: { name: 'To TOON' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Output Field',
        name: 'outputField',
        type: 'string',
        default: 'toon',
        description: 'Field name to store the TOON output',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const outputField = this.getNodeParameter('outputField', 0) as string;
    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const jsonData = item.json;

      // Calculate original JSON size
      const originalJson = JSON.stringify(jsonData);
      const originalSize = originalJson.length;

      // Convert to TOON
      const toonOutput = encode(jsonData);
      const toonSize = toonOutput.length;

      // Calculate savings
      const savedBytes = originalSize - toonSize;
      const savingsPercent = ((savedBytes / originalSize) * 100).toFixed(1);

      results.push({
        json: {
          [outputField]: toonOutput,
          _meta: {
            originalSizeBytes: originalSize,
            toonSizeBytes: toonSize,
            savedBytes,
            savingsPercent: `${savingsPercent}%`,
          },
        },
      });
    }

    return [results];
  }
}
```

### 4. `nodes/ToToon/toon.svg`
Simple icon (purple/blue gradient with "T" letter)

## Implementation Steps
1. Create all files above
2. Run `npm install`
3. Run `npm run build`
4. Link to n8n or use `npm run dev`

## Verification
1. `npm install` - Install dependencies
2. `npm run build` - Compile TypeScript (should produce `dist/` folder)
3. Link to local n8n: `npm link` then in n8n folder `npm link n8n-nodes-toon`
4. Test workflow: Manual Trigger → Set (sample JSON) → To TOON → Check output has `toon` field + `_meta` with savings info
