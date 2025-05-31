module.exports = {
  branches: ['main', { name: 'next', prerelease: true }],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/changelog',
    ['@semantic-release/git', {
      assets: ['CHANGELOG.md'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
    }],
    '@semantic-release/github',
    ['@semantic-release/exec', {
      prepareCmd: `
        docker buildx build \\
          --platform linux/amd64 \\
          --label "org.opencontainers.image.source=https://github.com/MonsieurDahlstrom/xp-fn-node-cidr" \\
          --label "org.opencontainers.image.description=Node CIDR calculator" \\
          --label "org.opencontainers.image.version=$\{nextRelease.version}" \\
          --label "org.opencontainers.image.licenses=ISC" \\
          -t ghcr.io/monsieurdahlstrom/xp-fn-node-cidr:$\{nextRelease.version} \\
          -t ghcr.io/monsieurdahlstrom/xp-fn-node-cidr:latest \\
          --output=type=docker \\
          .
      `,
      publishCmd: `
        docker push ghcr.io/monsieurdahlstrom/xp-fn-node-cidr:$\{nextRelease.version}
        docker push ghcr.io/monsieurdahlstrom/xp-fn-node-cidr:latest
      `
    }]
  ]
} 