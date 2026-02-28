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

type PlainObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is PlainObject {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Flattens a single object's nested objects into dot-path keys and joins arrays into strings.
 * Uses the union schema to fill missing dot-path keys with null when a value is null
 * but other items have an object at that key.
 */
function flattenObject(
  obj: PlainObject,
  schema: Map<string, 'object' | 'array' | 'primitive'>,
  objectSchemas: Map<string, string[]>,
): PlainObject {
  const result: PlainObject = {};

  for (const [key, type] of schema) {
    const value = obj[key];

    if (type === 'object') {
      const subKeys = objectSchemas.get(key) ?? [];
      if (isPlainObject(value)) {
        // Flatten nested object into dot-path keys
        const flattened = flattenObjectRecursive(value, key);
        for (const subKey of subKeys) {
          const fullKey = `${key}.${subKey}`;
          result[fullKey] = fullKey in flattened ? flattened[fullKey] : null;
        }
      } else {
        // Value is null/missing — fill all sub-keys with null
        for (const subKey of subKeys) {
          result[`${key}.${subKey}`] = null;
        }
      }
    } else if (type === 'array') {
      const arr = value;
      if (Array.isArray(arr)) {
        result[key] = arr.length > 0 ? arr.join(', ') : '';
      } else {
        result[key] = value ?? null;
      }
    } else {
      result[key] = value ?? null;
    }
  }

  return result;
}

function flattenObjectRecursive(obj: PlainObject, prefix: string): PlainObject {
  const result: PlainObject = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}.${key}`;
    if (isPlainObject(value)) {
      Object.assign(result, flattenObjectRecursive(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

/**
 * Collects the union of all sub-keys across items for a given key where the value is an object.
 */
function collectObjectSubKeys(items: PlainObject[], key: string): string[] {
  const subKeys = new Set<string>();
  for (const item of items) {
    const val = item[key];
    if (isPlainObject(val)) {
      for (const k of Object.keys(val)) subKeys.add(k);
    }
  }
  return [...subKeys];
}

/**
 * Normalizes an array of objects so all items have identical flat primitive-only keys,
 * enabling TOON's tabular encoding mode.
 * Recurses into object values that contain arrays of objects.
 */
function normalizeForTabular(data: unknown): unknown {
  if (isPlainObject(data)) {
    const result: PlainObject = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = normalizeForTabular(value);
    }
    return result;
  }

  if (!Array.isArray(data)) return data;

  // Check if this is an array of objects
  const objects = data.filter(isPlainObject);
  if (objects.length !== data.length || objects.length === 0) return data;

  // Pass 1: Build union schema
  const schema = new Map<string, 'object' | 'array' | 'primitive'>();
  for (const item of objects) {
    for (const [key, value] of Object.entries(item)) {
      const existing = schema.get(key);
      if (isPlainObject(value)) {
        if (!existing || existing === 'primitive') schema.set(key, 'object');
      } else if (Array.isArray(value)) {
        if (!existing || existing === 'primitive') schema.set(key, 'array');
      } else {
        if (!existing) schema.set(key, 'primitive');
      }
    }
  }

  // Check if flattening is needed — if all values are already primitive, skip
  const needsFlatten = [...schema.values()].some((t) => t !== 'primitive');
  if (!needsFlatten) return data;

  // Collect sub-key schemas for object-type keys
  const objectSchemas = new Map<string, string[]>();
  for (const [key, type] of schema) {
    if (type === 'object') {
      objectSchemas.set(key, collectObjectSubKeys(objects, key));
    }
  }

  // Pass 2: Flatten each item
  return objects.map((item) => flattenObject(item, schema, objectSchemas));
}

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
            displayName: 'Indentation',
            name: 'indent',
            type: 'options',
            options: [
              { name: '2 Spaces', value: 2 },
              { name: '4 Spaces', value: 4 },
            ],
            default: 2,
            description: 'Number of spaces per indentation level',
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
          {
            displayName: 'Normalize Arrays',
            name: 'normalizeArrays',
            type: 'boolean',
            default: false,
            description:
              'Flatten nested objects and arrays within array items to enable tabular encoding. Nested object keys become dot-paths (e.g., due.start), arrays become comma-joined strings.',
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
        indent?: number;
        keyFolding?: string;
        normalizeArrays?: boolean;
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

      if (options.normalizeArrays) {
        jsonData = normalizeForTabular(jsonData);
      }

      const originalJson = JSON.stringify(jsonData);
      const originalSize = originalJson.length;

      const encodeOptions: { indent?: number; delimiter?: Delimiter; keyFolding?: 'off' | 'safe' } = {};
      if (options.indent && options.indent !== 2) {
        encodeOptions.indent = options.indent;
      }
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
