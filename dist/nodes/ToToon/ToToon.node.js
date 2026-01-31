"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToToon = void 0;
const toon_1 = require("@toon-format/toon");
class ToToon {
    constructor() {
        this.description = {
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
    }
    async execute() {
        const items = this.getInputData();
        const outputField = this.getNodeParameter('outputField', 0);
        const results = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const jsonData = item.json;
            // Calculate original JSON size
            const originalJson = JSON.stringify(jsonData);
            const originalSize = originalJson.length;
            // Convert to TOON
            const toonOutput = (0, toon_1.encode)(jsonData);
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
exports.ToToon = ToToon;
