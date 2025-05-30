import { calculateSubnets } from './cidr.js';

interface CrossplaneRequest {
    desired: any;
    observed: any;
    input: {
        baseCIDR: string;
        layout: Array<{
            name: string;
            percentage: number;
        }>;
    };
}

interface CrossplaneResponse {
    desired: {
        apiVersion: string;
        kind: string;
        metadata: {
            name: string;
        };
        spec: {
            baseCIDR: string;
            subnets: Array<{
                name: string;
                cidr: string;
            }>;
        };
    };
}

async function main() {
    try {
        // Read input from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const inputData = Buffer.concat(chunks).toString();
        const request: CrossplaneRequest = JSON.parse(inputData);

        // Validate input
        if (!request.input?.baseCIDR || !request.input?.layout) {
            const errorResponse = {
                status: 400,
                message: 'Missing required fields: baseCIDR and layout'
            };
            console.log(JSON.stringify(errorResponse));
            process.exit(1);
        }

        // Calculate subnets using the new function signature
        const subnets = calculateSubnets({
            baseCIDR: request.input.baseCIDR,
            layout: request.input.layout
        });

        // Create response
        const response: CrossplaneResponse = {
            desired: {
                apiVersion: 'network.example.com/v1',
                kind: 'NetworkLayout',
                metadata: {
                    name: 'calculated-subnets'
                },
                spec: {
                    baseCIDR: request.input.baseCIDR,
                    subnets
                }
            }
        };

        // Write response to stdout
        console.log(JSON.stringify(response));
    } catch (error) {
        const errorResponse = {
            status: 500,
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        console.log(JSON.stringify(errorResponse));
        process.exit(1);
    }
}

main();
