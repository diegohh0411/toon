import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { encode, DELIMITERS, type Delimiter } from '@toon-format/toon';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj);
}

const delimiterMap: Record<string, Delimiter> = {
  comma: DELIMITERS.comma,
  tab: DELIMITERS.tab,
  pipe: DELIMITERS.pipe,
};

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
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        options: [
          { name: 'Whole Item', value: 'wholeItem' },
          { name: 'Specific Field', value: 'specificField' },
        ],
        default: 'wholeItem',
        description: 'Whether to encode the entire item JSON or a specific field',
      },
      {
        displayName: 'Source Field',
        name: 'sourceField',
        type: 'string',
        default: '',
        placeholder: 'e.g. data, response.body',
        description: 'Dot-notation path to the field to encode',
        displayOptions: {
          show: { inputMode: ['specificField'] },
        },
      },
      {
        displayName: 'Output Field',
        name: 'outputField',
        type: 'string',
        default: 'toon',
        description: 'Field name to store the TOON output',
      },
      {
        displayName: 'Include Metadata',
        name: 'includeMetadata',
        type: 'boolean',
        default: true,
        description: 'Whether to include _meta with compression statistics',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Delimiter',
            name: 'delimiter',
            type: 'options',
            options: [
              { name: 'Comma (,)', value: 'comma' },
              { name: 'Tab', value: 'tab' },
              { name: 'Pipe (|)', value: 'pipe' },
            ],
            default: 'comma',
            description: 'Delimiter for tabular array rows. Tab can improve token efficiency.',
          },
          {
            displayName: 'Key Folding',
            name: 'keyFolding',
            type: 'options',
            options: [
              { name: 'Off', value: 'off' },
              { name: 'Safe', value: 'safe' },
            ],
            default: 'off',
            description:
              'Collapse single-key wrapper chains into dotted paths to save tokens on deeply nested data',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const inputMode = this.getNodeParameter('inputMode', i) as string;
      const outputField = this.getNodeParameter('outputField', i) as string;
      const includeMetadata = this.getNodeParameter('includeMetadata', i) as boolean;
      const options = this.getNodeParameter('options', i) as {
        delimiter?: string;
        keyFolding?: string;
      };

      let jsonData: unknown;
      if (inputMode === 'specificField') {
        const sourceField = this.getNodeParameter('sourceField', i) as string;
        jsonData = getNestedValue(items[i].json, sourceField);
        if (jsonData === undefined) {
          throw new Error(`Field "${sourceField}" not found in item ${i}`);
        }
      } else {
        jsonData = items[i].json;
      }

      const originalJson = JSON.stringify(jsonData);
      const originalSize = originalJson.length;

      const encodeOptions: { delimiter?: Delimiter; keyFolding?: 'off' | 'safe' } = {};
      if (options.delimiter && options.delimiter !== 'comma') {
        encodeOptions.delimiter = delimiterMap[options.delimiter];
      }
      if (options.keyFolding && options.keyFolding !== 'off') {
        encodeOptions.keyFolding = options.keyFolding as 'off' | 'safe';
      }

      const toonOutput = encode(jsonData, encodeOptions);
      const toonSize = toonOutput.length;

      const result: IDataObject = { [outputField]: toonOutput };

      if (includeMetadata) {
        const savedBytes = originalSize - toonSize;
        const savingsPercent = ((savedBytes / originalSize) * 100).toFixed(1);
        result._meta = {
          originalSizeBytes: originalSize,
          toonSizeBytes: toonSize,
          savedBytes,
          savingsPercent: `${savingsPercent}%`,
        };
      }

      results.push({ json: result });
    }

    return [results];
  }
}
