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
