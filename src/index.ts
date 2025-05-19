import fs from 'fs';
import yaml from 'js-yaml';
import CIDR from 'ip-cidr';

interface SubnetConfig {
    name: string;
    percent: number;
}

interface LayoutInput {
    baseCIDR: string;
    layout: SubnetConfig[];
}

interface SubnetOutput {
    name: string;
    cidr: string;
    prefix: number;
}

// Convert dotted IPv4 string to a 32-bit number
function ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
}

// Convert a 32-bit number back to a dotted IPv4 string
function longToIp(long: number): string {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255,
    ].join('.');
}

function calculateSubnets(baseCIDR: string, layout: SubnetConfig[]): SubnetOutput[] {
    const base = new CIDR(baseCIDR);

    if (!CIDR.isValidAddress(baseCIDR)) {
        throw new Error(`Invalid base CIDR: ${baseCIDR}`);
    }

    const prefixLength = parseInt(baseCIDR.split('/')[1], 10);
    const totalIPs = Math.pow(2, 32 - prefixLength);

    let currentLong = ipToLong(base.start());

    const subnets: SubnetOutput[] = [];

    for (const entry of layout) {
        const requiredIPs = Math.ceil(totalIPs * (entry.percent / 100));
        const subnetPrefix = 32 - Math.ceil(Math.log2(requiredIPs));
        const subnetSize = Math.pow(2, 32 - subnetPrefix);

        const subnetStartIp = longToIp(currentLong);
        const subnetCIDR = `${subnetStartIp}/${subnetPrefix}`;

        subnets.push({
            name: entry.name,
            cidr: subnetCIDR,
            prefix: subnetPrefix
        });

        currentLong += subnetSize;
    }

    return subnets;
}

// Load and parse layout input
const rawInput = fs.readFileSync('network-layout.json', 'utf-8');
const config: LayoutInput = JSON.parse(rawInput);

// Generate subnets
const subnets = calculateSubnets(config.baseCIDR, config.layout);

// Output to YAML
const output = {
    apiVersion: 'network.example.org/v1alpha1',
    kind: 'NetworkLayout',
    metadata: {
        name: 'calculated-layout'
    },
    spec: {
        baseCIDR: config.baseCIDR,
        subnets
    }
};

fs.writeFileSync('output.yaml', yaml.dump(output), 'utf-8');
console.log('✅ output.yaml generated.');
