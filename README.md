# n8n-nodes-toonify

An n8n community node that converts JSON to [TOON format](https://toonformat.dev) for reduced LLM token usage.

## What is TOON?

TOON (Token-Oriented Object Notation) is a compact, human-readable encoding of JSON that uses YAML-like indentation with CSV-style tabular arrays. It typically achieves **30-50% fewer tokens** than equivalent JSON while maintaining high LLM comprehension accuracy.

## Installation

1. In your n8n instance, go to **Settings > Community Nodes**
2. Enter `n8n-nodes-toonify`
3. Click **Install**

## Usage

Add the **To TOON** node after any node that outputs JSON data. The node encodes each item into TOON format and optionally reports compression statistics.

## Configuration

### Main Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| **Input Mode** | Dropdown | Whole Item | Encode the entire item or a specific field |
| **Source Field** | String | — | Dot-notation path to the field to encode (shown when Input Mode = Specific Field) |
| **Output Field** | String | `toon` | Field name to store the TOON output |
| **Include Metadata** | Boolean | `true` | Include `_meta` object with compression statistics |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Delimiter** | Dropdown | Comma | Row delimiter for tabular arrays. Tab delimiters can improve token efficiency |
| **Key Folding** | Dropdown | Off | Collapse single-key wrapper chains into dotted paths (e.g. `data.metadata.items:`) to save tokens on deeply nested data |

## Example

**Input JSON:**
```json
{
  "id": 1,
  "name": "Alice",
  "roles": ["admin", "editor"]
}
```

**Output:**
```json
{
  "toon": "id: 1\nname: Alice\nroles[2]\n  admin\n  editor",
  "_meta": {
    "originalSizeBytes": 52,
    "toonSizeBytes": 41,
    "savedBytes": 11,
    "savingsPercent": "21.2%"
  }
}
```

## Links

- [TOON Format Specification](https://toonformat.dev)
- [`@toon-format/toon` npm package](https://www.npmjs.com/package/@toon-format/toon)

## License

[MIT](LICENSE)
