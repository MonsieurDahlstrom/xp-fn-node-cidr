import CIDR from 'ip-cidr';

interface SubnetConfig {
    name: string;
    percentage: number;
}

export interface LayoutInput {
    baseCIDR: string;
    layout: SubnetConfig[];
}

interface SubnetOutput {
    name: string;
    cidr: string;
}

// Convert IP to long integer
function ipToLong(ip: string): number {
    return ip.split('.')
        .reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

// Convert long integer to IP
function longToIp(long: number): string {
    return [
        (long >>> 24) & 255,
        (long >>> 16) & 255,
        (long >>> 8) & 255,
        long & 255
    ].join('.');
}

// Calculate subnet size based on percentage with space-efficient allocation
function calculateSubnetSize(totalIPs: number, percentage: number): { size: number; prefix: number } {
    // For very small percentages, use minimum /28 (16 IPs)
    if (percentage <= 1) {
        return { size: 16, prefix: 28 };
    }

    // For practical allocation, use common subnet sizes
    // rather than exact percentage calculations

    if (percentage <= 6.25) {  // <= 6.25% gets /28 (16 IPs)
        return { size: 16, prefix: 28 };
    } else if (percentage <= 12.5) {  // <= 12.5% gets /27 (32 IPs)
        return { size: 32, prefix: 27 };
    } else if (percentage <= 25) {  // <= 25% gets /26 (64 IPs)
        return { size: 64, prefix: 26 };
    } else {  // > 25% gets /25 (128 IPs)
        return { size: 128, prefix: 25 };
    }
}

export function calculateSubnets(input: LayoutInput): SubnetOutput[] {
    const { baseCIDR, layout } = input;

    if (!CIDR.isValidAddress(baseCIDR)) {
        throw new Error('Invalid CIDR address');
    }

    const cidr = new CIDR(baseCIDR);
    const startIP = ipToLong(cidr.start());
    const endIP = ipToLong(cidr.end());
    const totalIPs = endIP - startIP + 1;

    // Calculate total percentage
    const totalPercentage = layout.reduce((sum, subnet) => sum + subnet.percentage, 0);
    if (totalPercentage > 100) {
        throw new Error('Total percentage exceeds 100%');
    }

    // For 100% allocation of single subnet, return the entire CIDR
    if (layout.length === 1 && layout[0].percentage === 100) {
        return [{
            name: layout[0].name,
            cidr: baseCIDR
        }];
    }

    // Calculate subnet sizes
    const subnets = layout.map(config => ({
        ...config,
        ...calculateSubnetSize(totalIPs, config.percentage)
    }));

    // Sort subnets by size (largest first) for better alignment
    const sortedSubnets = [...subnets].sort((a, b) => b.size - a.size);

    // Allocate subnets with proper alignment
    const results: SubnetOutput[] = [];
    let currentIP = startIP;
    const allocatedRanges: Array<{ start: number, end: number, name: string, cidr: string }> = [];

    for (const subnet of sortedSubnets) {
        // Find the next aligned position for this subnet size
        const alignmentMask = subnet.size - 1;
        let alignedIP = (currentIP + alignmentMask) & ~alignmentMask;

        // Make sure this aligned position doesn't overlap with already allocated ranges
        while (alignedIP <= endIP) {
            const wouldOverlap = allocatedRanges.some(range =>
                !(alignedIP + subnet.size <= range.start || alignedIP > range.end)
            );

            if (!wouldOverlap && alignedIP + subnet.size - 1 <= endIP) {
                break;
            }

            // Try next alignment boundary
            alignedIP += subnet.size;
            alignedIP = (alignedIP + alignmentMask) & ~alignmentMask;
        }

        if (alignedIP + subnet.size - 1 > endIP) {
            throw new Error(`Subnet ${subnet.name} does not fit in the base CIDR range`);
        }

        const subnetCIDR = `${longToIp(alignedIP)}/${subnet.prefix}`;
        allocatedRanges.push({
            start: alignedIP,
            end: alignedIP + subnet.size - 1,
            name: subnet.name,
            cidr: subnetCIDR
        });

        currentIP = Math.max(currentIP, alignedIP + subnet.size);
    }

    // Sort results back to original order
    const originalOrder = layout.map(config => config.name);
    allocatedRanges.sort((a, b) => originalOrder.indexOf(a.name) - originalOrder.indexOf(b.name));

    // Convert to results
    allocatedRanges.forEach(range => {
        results.push({
            name: range.name,
            cidr: range.cidr
        });
    });

    // Add reserve subnet if total percentage is less than 100%
    if (totalPercentage < 100) {
        const reserveIPs = endIP - currentIP + 1;
        if (reserveIPs > 0) {
            // Find largest aligned block for reserve
            let reserveSize = 1;
            while (reserveSize <= reserveIPs && (currentIP & (reserveSize - 1)) === 0) {
                if (reserveSize * 2 <= reserveIPs) {
                    reserveSize *= 2;
                } else {
                    break;
                }
            }

            const reservePrefix = 32 - Math.log2(reserveSize);
            results.push({
                name: 'reserve',
                cidr: `${longToIp(currentIP)}/${reservePrefix}`
            });
        }
    }

    return results;
}

export { ipToLong, longToIp }; 