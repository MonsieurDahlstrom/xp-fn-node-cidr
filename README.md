# CIDR Calculator - Crossplane Function

A Node.js Crossplane Function that calculates subnet allocations from a base CIDR block based on percentage requirements.

## Features

- **Valid CIDR Allocation**: Generates properly aligned CIDR blocks that follow RFC standards
- **Percentage-Based**: Allocates subnets based on percentage of total IP space needed
- **Deterministic**: Consistent allocation behavior - adding new subnets doesn't change existing ones
- **Reserve Handling**: Automatically creates reserve subnets for unused IP space
- **Space Efficient**: Optimizes allocation to minimize IP waste

## Usage

### Input Format

```json
{
  "input": {
    "baseCIDR": "10.0.0.0/24",
    "layout": [
      { "name": "web", "percentage": 25 },
      { "name": "api", "percentage": 25 },
      { "name": "db", "percentage": 25 }
    ]
  }
}
```

### Output Format

```json
{
  "desired": {
    "apiVersion": "network.example.com/v1",
    "kind": "NetworkLayout",
    "metadata": {
      "name": "calculated-subnets"
    },
    "spec": {
      "baseCIDR": "10.0.0.0/24",
      "subnets": [
        { "name": "web", "cidr": "10.0.0.0/26" },
        { "name": "api", "cidr": "10.0.0.64/26" },
        { "name": "db", "cidr": "10.0.0.128/26" },
        { "name": "reserve", "cidr": "10.0.0.192/26" }
      ]
    }
  }
}
```

## Development

### Prerequisites

- Node.js 18+
- TypeScript
- Jest for testing

### Installation

```bash
npm install
```

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running as Crossplane Function

```bash
# Build Docker image
docker build -t cidr-calculator .

# Test with input
echo '{"input":{"baseCIDR":"10.0.0.0/24","layout":[{"name":"web","percentage":50}]}}' | docker run -i cidr-calculator
```

## Algorithm

The function uses a space-efficient allocation algorithm that:

1. **Sorts subnets by size** (largest first) for optimal placement
2. **Ensures proper CIDR alignment** for all subnet boundaries
3. **Maintains deterministic behavior** - same inputs always produce same outputs
4. **Handles percentage-to-subnet mapping**:
   - ≤ 1%: /28 (16 IPs)
   - ≤ 6.25%: /28 (16 IPs)
   - ≤ 12.5%: /27 (32 IPs)
   - ≤ 25%: /26 (64 IPs)
   - \> 25%: /25 (128 IPs)

## Testing

The project includes comprehensive tests covering:

- IP conversion functions
- Subnet calculations with various percentages
- Reserve subnet handling
- Edge cases and error conditions
- **Allocation consistency** - verifies that adding subnets doesn't change existing allocations

## License

[Add your license here] 
