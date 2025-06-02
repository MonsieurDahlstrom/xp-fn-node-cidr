import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { calculateSubnets } from './cidr.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the proto definition
const protoPath = path.join(__dirname, '../proto/run_function.proto');
const protoLoaderOptions = {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
};

const packageDefinition = protoLoader.loadSync(protoPath, protoLoaderOptions);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

// Get the FunctionRunnerService from the loaded package
const FunctionRunnerService = protoDescriptor.apiextensions.fn.proto.v1.FunctionRunnerService;

// Helper function to convert protobuf struct format to regular JS objects
function convertProtobufStruct(fields: any): any {
    if (!fields) return null;

    const result: any = {};

    for (const [key, value] of Object.entries(fields)) {
        const fieldValue = value as any;

        if (fieldValue.stringValue !== undefined) {
            result[key] = fieldValue.stringValue;
        } else if (fieldValue.numberValue !== undefined) {
            result[key] = fieldValue.numberValue;
        } else if (fieldValue.boolValue !== undefined) {
            result[key] = fieldValue.boolValue;
        } else if (fieldValue.structValue && fieldValue.structValue.fields) {
            result[key] = convertProtobufStruct(fieldValue.structValue.fields);
        } else if (fieldValue.listValue && fieldValue.listValue.values) {
            result[key] = fieldValue.listValue.values.map((item: any) => {
                if (item.structValue && item.structValue.fields) {
                    return convertProtobufStruct(item.structValue.fields);
                }
                return item.stringValue || item.numberValue || item.boolValue || item;
            });
        } else if (fieldValue.nullValue !== undefined) {
            result[key] = null;
        } else {
            // If we don't recognize the structure, keep as is
            result[key] = fieldValue;
        }
    }

    return result;
}

// Helper function to convert JavaScript objects to protobuf struct format
function convertToProtobufStruct(obj: any): any {
    if (obj === null || obj === undefined) {
        return { nullValue: 'NULL_VALUE' };
    }

    if (typeof obj === 'string') {
        return { stringValue: obj };
    }

    if (typeof obj === 'number') {
        return { numberValue: obj };
    }

    if (typeof obj === 'boolean') {
        return { boolValue: obj };
    }

    if (Array.isArray(obj)) {
        return {
            listValue: {
                values: obj.map(item => convertToProtobufStruct(item))
            }
        };
    }

    if (typeof obj === 'object') {
        const fields: any = {};
        for (const [key, value] of Object.entries(obj)) {
            fields[key] = convertToProtobufStruct(value);
        }
        return {
            structValue: {
                fields: fields
            }
        };
    }

    return { stringValue: String(obj) };
}

// Define the interfaces matching the proto
interface RunFunctionRequest {
    meta?: { tag?: string };
    observed?: {
        composite?: {
            resource?: any;
        };
        resources?: { [key: string]: any };
    };
    desired?: {
        composite?: {
            resource?: any;
        };
        resources?: { [key: string]: any };
    };
    input?: any;
    context?: any;
    extra_resources?: { [key: string]: any };
    credentials?: { [key: string]: any };
}

interface RunFunctionResponse {
    meta?: { tag?: string; ttl?: any };
    desired?: {
        composite?: {
            resource?: any;
        };
        resources?: { [key: string]: any };
    };
    results?: Array<{
        severity?: string;
        message?: string;
        reason?: string;
        target?: string;
    }>;
    context?: any;
    requirements?: any;
    conditions?: any;
}

// Implement the RunFunction gRPC method
function runFunction(call: grpc.ServerUnaryCall<RunFunctionRequest, RunFunctionResponse>, callback: grpc.sendUnaryData<RunFunctionResponse>) {
    try {
        console.log('Received RunFunction request');

        const request = call.request;

        // Extract the observed composite resource - handle protobuf structure
        let observedComposite;
        const compositeResourceStruct = request?.observed?.composite?.resource;

        if (compositeResourceStruct?.fields) {
            // Convert protobuf struct format to regular object
            observedComposite = convertProtobufStruct(compositeResourceStruct.fields);
        } else {
            observedComposite = compositeResourceStruct;
        }

        if (!observedComposite) {
            console.error('No observed composite resource found');
            const errorResponse: RunFunctionResponse = {
                meta: { tag: request?.meta?.tag || '' },
                desired: request?.desired || {},
                results: [{
                    severity: 'SEVERITY_FATAL',
                    message: 'No observed composite resource found',
                    reason: 'MissingComposite'
                }]
            };
            return callback(null, errorResponse);
        }

        console.log('Processing composite resource:', {
            apiVersion: observedComposite.apiVersion,
            kind: observedComposite.kind,
            name: observedComposite.metadata?.name,
            baseCIDR: observedComposite.spec?.baseCIDR,
            layoutItems: observedComposite.spec?.layout?.length
        });

        // Extract the required fields from the composite resource
        const baseCIDR = observedComposite.spec?.baseCIDR;
        const layout = observedComposite.spec?.layout;

        if (!baseCIDR || !layout) {
            console.error('Missing required fields:', { baseCIDR, layout });
            const errorResponse: RunFunctionResponse = {
                meta: { tag: request?.meta?.tag || '' },
                desired: request?.desired || {},
                results: [{
                    severity: 'SEVERITY_FATAL',
                    message: `Missing required fields: baseCIDR=${baseCIDR}, layout=${JSON.stringify(layout)}`,
                    reason: 'MissingRequiredFields'
                }]
            };
            return callback(null, errorResponse);
        }

        console.log('Calculating subnets for:', { baseCIDR, layoutItems: layout.length });

        // Calculate the subnets
        const subnetResult = calculateSubnets({ baseCIDR, layout });
        console.log('Calculated subnets:', subnetResult);

        // Create the status object that we want to update
        const statusUpdate = {
            subnets: subnetResult,
            summary: {
                baseCIDR: baseCIDR,
                totalSubnets: subnetResult.length,
                utilizedAddresses: subnetResult.reduce((sum: number, subnet: any) => sum + (subnet.totalAddresses || 0), 0)
            }
        };

        // Since Crossplane functions cannot directly set composite resource status,
        // we'll create a ConfigMap managed resource to store the calculated data
        const configMapName = `${observedComposite.metadata?.name || 'unknown'}-cidr-results`;

        // Create the ConfigMap resource with proper structure
        const configMapResource = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: configMapName,
                labels: {
                    'app.kubernetes.io/managed-by': 'crossplane',
                    'cidr-calculator.crossplane.io/composite': observedComposite.metadata?.name || 'unknown'
                }
            },
            data: {
                'subnets.json': JSON.stringify(subnetResult, null, 2),
                'summary.json': JSON.stringify(statusUpdate.summary, null, 2),
                'baseCIDR': baseCIDR,
                'totalSubnets': subnetResult.length.toString()
            }
        };

        // Convert to protobuf format
        const configMapProtobuf = convertToProtobufStruct(configMapResource);

        // Get existing desired resources and add our ConfigMap
        const desiredResources = request?.desired?.resources || {};
        desiredResources['cidr-results-configmap'] = {
            resource: configMapProtobuf
        };

        const response: RunFunctionResponse = {
            meta: {
                tag: request?.meta?.tag || '',
                ttl: { seconds: 60 } // Cache for 60 seconds
            },
            desired: {
                composite: request?.desired?.composite || {},
                resources: desiredResources
            },
            results: [{
                severity: 'SEVERITY_NORMAL',
                message: `Successfully calculated ${subnetResult.length} subnets for ${baseCIDR}: ${subnetResult.map(s => s.name + '=' + s.cidr).join(', ')}. Results stored in ConfigMap '${configMapName}'.`,
                reason: 'SubnetCalculationComplete'
            }]
        };

        console.log('Sending response with calculated subnets');
        console.log('Status update object:', JSON.stringify(statusUpdate, null, 2));
        console.log('Desired composite resource structure:', JSON.stringify(desiredResources, null, 2));
        console.log('Full response structure:', JSON.stringify(response, null, 2));
        callback(null, response);

    } catch (error) {
        console.error('Error in runFunction:', error);
        const errorResponse: RunFunctionResponse = {
            meta: { tag: call.request?.meta?.tag || '' },
            desired: call.request?.desired || {},
            results: [{
                severity: 'SEVERITY_FATAL',
                message: `Function error: ${error instanceof Error ? error.message : String(error)}`,
                reason: 'FunctionError'
            }]
        };
        callback(null, errorResponse);
    }
}

// Create and start the gRPC server
function main() {
    const server = new grpc.Server();

    // Add the FunctionRunnerService implementation
    server.addService(FunctionRunnerService.service, {
        RunFunction: runFunction
    });

    // Configure TLS for Crossplane
    const port = process.env.PORT || '9443';
    const host = process.env.HOST || '0.0.0.0';

    // Use TLS credentials - Crossplane mounts TLS certificates automatically
    let credentials;
    try {
        // Crossplane mounts TLS certificates at these paths
        const serverCert = fs.readFileSync('/tls/server/tls.crt');
        const serverKey = fs.readFileSync('/tls/server/tls.key');

        credentials = grpc.ServerCredentials.createSsl(
            null, // No root CA needed for server
            [{
                cert_chain: serverCert,
                private_key: serverKey
            }],
            false // Don't require client certificates
        );

        console.log('Using TLS credentials for Crossplane compatibility');
    } catch (error) {
        console.log('TLS certificates not found, using insecure credentials:', error instanceof Error ? error.message : String(error));
        credentials = grpc.ServerCredentials.createInsecure();
    }

    // Start the server
    server.bindAsync(`${host}:${port}`, credentials, (error, boundPort) => {
        if (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }

        console.log(`CIDR Calculator Function gRPC server listening on ${host}:${boundPort}`);
        console.log('Function is ready to receive Crossplane requests');
    });
}

// Start the server
main();
