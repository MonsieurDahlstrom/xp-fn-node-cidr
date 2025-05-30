import { calculateSubnets, ipToLong, longToIp } from './cidr.js';

describe('CIDR Calculator', () => {
    describe('IP Conversion', () => {
        test('converts IP to long and back', () => {
            const ip = '192.168.1.1';
            const long = ipToLong(ip);
            expect(longToIp(long)).toBe(ip);
        });

        test('handles zero IP', () => {
            const ip = '0.0.0.0';
            const long = ipToLong(ip);
            expect(longToIp(long)).toBe(ip);
        });

        test('handles max IP', () => {
            const ip = '255.255.255.255';
            const long = ipToLong(ip);
            expect(longToIp(long)).toBe(ip);
        });
    });

    describe('Subnet Calculation', () => {
        test('calculates equal subnets', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'subnet1', percentage: 50 },
                    { name: 'subnet2', percentage: 50 }
                ]
            });
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('subnet1');
            expect(result[0].cidr).toBe('10.0.0.0/25');
            expect(result[1].name).toBe('subnet2');
            expect(result[1].cidr).toBe('10.0.0.128/25');
        });

        test('calculates unequal subnets', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'subnet1', percentage: 75 },
                    { name: 'subnet2', percentage: 25 }
                ]
            });
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('subnet1');
            expect(result[0].cidr).toBe('10.0.0.0/25');
            expect(result[1].name).toBe('subnet2');
            expect(result[1].cidr).toBe('10.0.0.128/26');
        });

        test('handles small subnet percentages', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'tiny', percentage: 1 },
                    { name: 'rest', percentage: 99 }
                ]
            });
            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('tiny');
            expect(result[0].cidr).toBe('10.0.0.128/28');
            expect(result[1].name).toBe('rest');
            expect(result[1].cidr).toBe('10.0.0.0/25');
        });

        test('throws error for invalid CIDR', () => {
            expect(() => {
                calculateSubnets({
                    baseCIDR: 'invalid', layout: [
                        { name: 'subnet1', percentage: 100 }
                    ]
                });
            }).toThrow('Invalid CIDR address');
        });

        test('handles single subnet', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'subnet1', percentage: 100 }
                ]
            });
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('subnet1');
            expect(result[0].cidr).toBe('10.0.0.0/24');
        });

        test('handles multiple small subnets', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'tiny1', percentage: 1 },
                    { name: 'tiny2', percentage: 1 },
                    { name: 'rest', percentage: 98 }
                ]
            });
            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('tiny1');
            expect(result[0].cidr).toBe('10.0.0.128/28');
            expect(result[1].name).toBe('tiny2');
            expect(result[1].cidr).toBe('10.0.0.144/28');
            expect(result[2].name).toBe('rest');
            expect(result[2].cidr).toBe('10.0.0.0/25');
        });

        test('adds reserve subnet when total percentage is less than 100', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/16', layout: [
                    { name: 'subnet1', percentage: 25 },
                    { name: 'subnet2', percentage: 25 }
                ]
            });
            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('subnet1');
            expect(result[0].cidr).toBe('10.0.0.0/26');
            expect(result[1].name).toBe('subnet2');
            expect(result[1].cidr).toBe('10.0.0.64/26');
            expect(result[2].name).toBe('reserve');
            expect(result[2].cidr).toBe('10.0.0.128/24');
        });

        test('adds reserve subnet for very small allocations', () => {
            const result = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'tiny1', percentage: 1 },
                    { name: 'tiny2', percentage: 1 }
                ]
            });
            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('tiny1');
            expect(result[0].cidr).toBe('10.0.0.0/28');
            expect(result[1].name).toBe('tiny2');
            expect(result[1].cidr).toBe('10.0.0.16/28');
            expect(result[2].name).toBe('reserve');
            expect(result[2].cidr).toBe('10.0.0.32/26');
        });

        test('throws error when total percentage exceeds 100', () => {
            expect(() => {
                calculateSubnets({
                    baseCIDR: '10.0.0.0/24', layout: [
                        { name: 'subnet1', percentage: 60 },
                        { name: 'subnet2', percentage: 50 }
                    ]
                });
            }).toThrow('Total percentage exceeds 100%');
        });

        test('maintains consistent allocation when adding more subnets', () => {
            // First allocation: 3 subnets totaling 75%
            const firstRun = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'web', percentage: 25 },
                    { name: 'api', percentage: 25 },
                    { name: 'db', percentage: 25 }
                ]
            });

            // Second allocation: 4 subnets totaling 95% (same first 3 + one more)
            const secondRun = calculateSubnets({
                baseCIDR: '10.0.0.0/24', layout: [
                    { name: 'web', percentage: 25 },
                    { name: 'api', percentage: 25 },
                    { name: 'db', percentage: 25 },
                    { name: 'cache', percentage: 20 }
                ]
            });

            // Verify first run has 4 entries (3 subnets + reserve)
            expect(firstRun).toHaveLength(4);
            expect(firstRun[3].name).toBe('reserve');

            // Verify second run has 4 entries (no reserve since 95% < 100%)
            expect(secondRun).toHaveLength(4);
            expect(secondRun[3].name).toBe('cache');

            // Most importantly: the first 3 subnets should be identical in both runs
            for (let i = 0; i < 3; i++) {
                expect(firstRun[i].name).toBe(secondRun[i].name);
                expect(firstRun[i].cidr).toBe(secondRun[i].cidr);
            }

            // Additional verification: check specific allocations are as expected
            expect(firstRun[0].name).toBe('web');
            expect(firstRun[1].name).toBe('api');
            expect(firstRun[2].name).toBe('db');

            expect(secondRun[0].name).toBe('web');
            expect(secondRun[1].name).toBe('api');
            expect(secondRun[2].name).toBe('db');
            expect(secondRun[3].name).toBe('cache');
        });
    });
}); 