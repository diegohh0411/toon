import { ToToon } from '../nodes/ToToon/ToToon.node';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

// Mock the execution context
const mockExecuteFunctions = {
  getInputData: () => {
    return [
      {
        json: {
          id: 1,
          name: "Alice",
          roles: ["admin", "editor"]
        }
      },
      {
        json: {
          id: 2,
          name: "Bob",
          roles: ["viewer"]
        }
      }
    ] as INodeExecutionData[];
  },
  getNodeParameter: (parameterName: string) => {
    if (parameterName === 'outputField') return 'myToonField';
    return '';
  }
} as unknown as IExecuteFunctions;

async function runTest() {
  console.log("Starting ToToon Node Test...\n");

  const node = new ToToon();
  
  // Bind the mock context to the execute function
  const execute = node.execute.bind(mockExecuteFunctions);

  try {
    const results = await execute();
    const outputItems = results[0];

    outputItems.forEach((item, index) => {
      console.log(`--- Item ${index + 1} ---`);
      console.log("Original JSON:", JSON.stringify(mockExecuteFunctions.getInputData()[index].json));
      console.log("Result:", JSON.stringify(item.json, null, 2));
      console.log("------------------\n");
    });

    console.log("Test execution successful!");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
