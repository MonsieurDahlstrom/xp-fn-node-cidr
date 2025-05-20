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
        IMAGE_NAME="ghcr.io/monsieurdahlstrom/xp-fn-node-cidr"
        docker buildx build \\
          --platform linux/amd64 \\
          --label "org.opencontainers.image.source=https://github.com/MonsieurDahlstrom/xp-fn-node-cidr" \\
          --label "org.opencontainers.image.description=Node CIDR calculator" \\
          --label "org.opencontainers.image.version=$\{nextRelease.version}" \\
          --label "org.opencontainers.image.licenses=ISC" \\
          -t $\{IMAGE_NAME}:$\{nextRelease.version} \\
          -t $\{IMAGE_NAME}:latest \\
          --output=type=docker \\
          .
      `,
      publishCmd: `
        IMAGE_NAME="ghcr.io/monsieurdahlstrom/xp-fn-node-cidr"
        docker push $\{IMAGE_NAME}:$\{nextRelease.version}
        docker push $\{IMAGE_NAME}:latest
      `
    }]
  ]
}
