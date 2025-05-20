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
        docker build \\
          --label "org.opencontainers.image.source=https://github.com/$\{process.env.GITHUB_REPOSITORY}" \\
          --label "org.opencontainers.image.description=Automatically released from semantic-release" \\
          --label "org.opencontainers.image.licenses=MIT" \\
          -t ghcr.io/$\{process.env.GITHUB_REPOSITORY.toLowerCase()}:$\{nextRelease.version} .
      `,
      publishCmd: `
        docker push ghcr.io/$\{process.env.GITHUB_REPOSITORY.toLowerCase()}:$\{nextRelease.version} && \\
        docker tag ghcr.io/$\{process.env.GITHUB_REPOSITORY.toLowerCase()}:$\{nextRelease.version} ghcr.io/$\{process.env.GITHUB_REPOSITORY.toLowerCase()}:latest && \\
        docker push ghcr.io/$\{process.env.GITHUB_REPOSITORY.toLowerCase()}:latest
      `
    }]
  ]
}
